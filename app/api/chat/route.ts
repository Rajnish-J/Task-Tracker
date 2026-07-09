import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getAnthropicClient, getModel, isChatConfigured } from "@/lib/ai/client";
import { buildWorkspaceContext } from "@/lib/ai/context";
import { buildSystemBlocks } from "@/lib/ai/system-prompt";
import { activityLabelFor, MUTATION_TOOL_NAMES } from "@/lib/ai/tool-catalog";
import { CHAT_TOOLS, executeTool } from "@/lib/ai/tools";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessages, conversations } from "@/lib/db/schema";

// Node runtime is required: the Neon driver needs ws for transactions, and the
// agentic loop can stream for a while.
export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(2000),
  enabledTools: z.array(z.string()).optional(),
});

// Hard caps keeping cost and latency bounded.
const MAX_TOOL_ITERATIONS = 10;
const HISTORY_ROWS = 40;
const MAX_PERSISTED_TOOL_RESULT = 6_000;

type StoredContent = Anthropic.MessageParam["content"];

function extractText(content: Anthropic.ContentBlockParam[] | Anthropic.ContentBlock[]) {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

async function nextIdx(conversationId: string) {
  const [last] = await db
    .select({ idx: chatMessages.idx })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.idx))
    .limit(1);
  return (last?.idx ?? -1) + 1;
}

async function persistRow(
  conversationId: string,
  role: "user" | "assistant",
  content: unknown,
  text: string | null,
) {
  await db.insert(chatMessages).values({
    conversationId,
    idx: await nextIdx(conversationId),
    role,
    content,
    text,
  });
}

// Load replayable history: last N rows, head-trimmed so the sequence starts at
// a user text message (the API rejects histories starting with an orphaned
// tool_result), and tail-trimmed so it never ends with an assistant tool_use
// row missing its tool_result (possible if a previous stream aborted mid-loop).
async function loadHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.idx))
    .limit(HISTORY_ROWS);
  rows.reverse();

  const isBlockArray = (content: unknown): content is Anthropic.ContentBlockParam[] =>
    Array.isArray(content);

  let start = 0;
  for (; start < rows.length; start += 1) {
    const row = rows[start];
    if (row.role !== "user" || !isBlockArray(row.content)) continue;
    if (row.content.some((block) => block.type === "text")) break;
  }
  let trimmed = rows.slice(start);

  const last = trimmed[trimmed.length - 1];
  if (
    last?.role === "assistant" &&
    isBlockArray(last.content) &&
    last.content.some((block) => block.type === "tool_use")
  ) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed.map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content as StoredContent,
  }));
}

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(
    new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = session.user.id;

  if (!isChatConfigured()) {
    return NextResponse.json(
      { error: "Chat is not configured. Set ANTHROPIC_API_KEY in the environment." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Load or create the conversation, ownership-checked.
  let conversationId = body.conversationId;
  if (conversationId) {
    const owned = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, uid)),
      columns: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  } else {
    const [created] = await db
      .insert(conversations)
      .values({ title: body.message.slice(0, 60), userId: uid })
      .returning({ id: conversations.id });
    conversationId = created.id;
  }

  await persistRow(
    conversationId,
    "user",
    [{ type: "text", text: body.message }],
    body.message,
  );
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  const [history, snapshot] = await Promise.all([
    loadHistory(conversationId),
    buildWorkspaceContext(uid),
  ]);

  const tools = body.enabledTools
    ? CHAT_TOOLS.filter((tool) => body.enabledTools!.includes(tool.name))
    : CHAT_TOOLS;
  const system = buildSystemBlocks(snapshot);
  const client = getAnthropicClient();
  const model = getModel();

  const convId = conversationId;
  const stream = new ReadableStream({
    async start(controller) {
      let mutated = false;
      try {
        sse(controller, "meta", { conversationId: convId });

        const messages: Anthropic.MessageParam[] = [...history];
        let iteration = 0;

        for (; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
          const responseStream = client.messages.stream({
            model,
            max_tokens: 8192,
            system,
            tools,
            messages,
          });

          responseStream.on("text", (delta) => {
            sse(controller, "text", { delta });
          });

          const message = await responseStream.finalMessage();
          messages.push({ role: "assistant", content: message.content });
          await persistRow(
            convId,
            "assistant",
            message.content,
            extractText(message.content) || null,
          );

          if (message.stop_reason !== "tool_use") {
            break;
          }

          const toolUses = message.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            sse(controller, "tool", {
              name: toolUse.name,
              label: activityLabelFor(toolUse.name),
              state: "start",
            });
            const result = await executeTool(toolUse.name, toolUse.input, uid);
            results.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: result.content.slice(0, MAX_PERSISTED_TOOL_RESULT),
              is_error: result.isError,
            });
            sse(controller, "tool", {
              name: toolUse.name,
              state: "end",
              ok: !result.isError,
            });
            if (!result.isError && MUTATION_TOOL_NAMES.has(toolUse.name)) {
              mutated = true;
            }
          }

          // All tool results go back in ONE user message.
          messages.push({ role: "user", content: results });
          await persistRow(convId, "user", results, null);
        }

        if (iteration >= MAX_TOOL_ITERATIONS) {
          sse(controller, "error", {
            message: "I hit my action limit for one message — please continue in a new message.",
          });
        }

        sse(controller, "done", { mutated });
      } catch (error) {
        let message = "Something went wrong while generating a reply.";
        if (error instanceof Anthropic.AuthenticationError) {
          message = "The Anthropic API key is invalid — check ANTHROPIC_API_KEY.";
        } else if (error instanceof Anthropic.RateLimitError) {
          message = "The assistant is busy right now — please retry in a moment.";
        } else if (error instanceof Anthropic.APIError) {
          message = `The AI service returned an error (${error.status}).`;
        }
        console.error("Chat stream failed:", error);
        try {
          sse(controller, "error", { message });
          sse(controller, "done", { mutated });
        } catch {
          // Controller already closed (client disconnected) — nothing to send.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
