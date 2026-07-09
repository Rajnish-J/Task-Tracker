import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";

import { activityLabelFor } from "@/lib/ai/tool-catalog";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessages, conversations } from "@/lib/db/schema";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function findOwnedConversation(conversationId: string, uid: string) {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, uid)),
    columns: { id: true, title: true },
  });
}

// A conversation's messages in a render-friendly shape. Rows that contain only
// tool_result blocks are folded away — their tool activity is derived from the
// preceding assistant row's tool_use blocks instead.
export async function GET(req: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const conversation = await findOwnedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      text: chatMessages.text,
    })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.idx));

  const messages = rows.flatMap((row) => {
    const blocks = Array.isArray(row.content)
      ? (row.content as Anthropic.ContentBlockParam[])
      : [];
    const toolCalls = blocks
      .filter((block) => block.type === "tool_use")
      .map((block) => ({
        name: (block as Anthropic.ToolUseBlockParam).name,
        label: activityLabelFor((block as Anthropic.ToolUseBlockParam).name),
      }));
    const text = row.text ?? "";

    // Skip synthetic user rows that only carry tool_result blocks.
    if (row.role === "user" && !text) return [];
    // Skip assistant rows with neither text nor tool calls.
    if (!text && toolCalls.length === 0) return [];

    return [
      {
        id: row.id,
        role: row.role as "user" | "assistant",
        text,
        toolCalls,
      },
    ];
  });

  return NextResponse.json({
    conversation: { id: conversation.id, title: conversation.title },
    messages,
  });
}

// Delete a conversation (messages cascade via FK).
export async function DELETE(req: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const conversation = await findOwnedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  await db.delete(conversations).where(eq(conversations.id, conversationId));
  return NextResponse.json({ ok: true });
}
