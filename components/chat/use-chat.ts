"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ChatMessageView, ToolChip } from "@/components/chat/types";

type UseChatOptions = {
  // Fired when the server assigns an id to a brand-new conversation (so the
  // conversation list can refresh/select it).
  onConversationCreated?: (conversationId: string) => void;
};

let clientMessageId = 0;
const nextId = () => `local-${++clientMessageId}`;

// Client state machine for one chat surface. Streams POST /api/chat (SSE over
// fetch), appends text deltas and tool chips to the in-flight assistant
// message, and refreshes server-rendered data when the assistant mutated the
// workspace.
export function useChat(options: UseChatOptions = {}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessageView[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const onCreatedRef = React.useRef(options.onConversationCreated);
  onCreatedRef.current = options.onConversationCreated;

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const updateAssistant = React.useCallback(
    (id: string, updater: (message: ChatMessageView) => ChatMessageView) => {
      setMessages((current) =>
        current.map((message) => (message.id === id ? updater(message) : message)),
      );
    },
    [],
  );

  const send = React.useCallback(
    async (text: string, enabledTools?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      const assistantId = nextId();
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "user", text: trimmed, toolCalls: [] },
        { id: assistantId, role: "assistant", text: "", toolCalls: [] },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId ?? undefined,
            message: trimmed,
            enabledTools,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (event: string, data: Record<string, unknown>) => {
          switch (event) {
            case "meta": {
              const id = data.conversationId as string;
              if (!conversationId && id) {
                setConversationId(id);
                onCreatedRef.current?.(id);
              }
              break;
            }
            case "text":
              updateAssistant(assistantId, (message) => ({
                ...message,
                text: message.text + ((data.delta as string) ?? ""),
              }));
              break;
            case "tool":
              if (data.state === "start") {
                updateAssistant(assistantId, (message) => ({
                  ...message,
                  toolCalls: [
                    ...message.toolCalls,
                    {
                      name: data.name as string,
                      label: (data.label as string) ?? (data.name as string),
                      state: "running" as const,
                    },
                  ],
                }));
              } else {
                updateAssistant(assistantId, (message) => {
                  const toolCalls: ToolChip[] = [...message.toolCalls];
                  for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
                    if (toolCalls[i].name === data.name && toolCalls[i].state === "running") {
                      toolCalls[i] = { ...toolCalls[i], state: data.ok ? "ok" : "error" };
                      break;
                    }
                  }
                  return { ...message, toolCalls };
                });
              }
              break;
            case "error": {
              const message = (data.message as string) ?? "Something went wrong.";
              setError(message);
              toast.error(message);
              break;
            }
            case "done":
              if (data.mutated) {
                // Server actions already revalidated; refresh re-renders the
                // boards/sidebar from fresh data behind the chat.
                router.refresh();
              }
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");

            let eventName = "message";
            let dataLine = "";
            for (const line of frame.split("\n")) {
              if (line.startsWith("event: ")) eventName = line.slice(7).trim();
              else if (line.startsWith("data: ")) dataLine += line.slice(6);
            }
            if (!dataLine) continue;
            try {
              handleEvent(eventName, JSON.parse(dataLine));
            } catch {
              // Malformed frame — skip.
            }
          }
        }
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          const message = cause instanceof Error ? cause.message : "Something went wrong.";
          setError(message);
          toast.error(message);
        }
      } finally {
        setIsStreaming(false);
        // Drop an assistant bubble that ended up completely empty.
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== assistantId || message.text || message.toolCalls.length > 0,
          ),
        );
      }
    },
    [conversationId, isStreaming, router, updateAssistant],
  );

  const loadConversation = React.useCallback(async (id: string) => {
    abortRef.current?.abort();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/conversations/${id}`);
      if (!response.ok) throw new Error("Could not load this conversation.");
      const payload = (await response.json()) as {
        messages: { id: string; role: "user" | "assistant"; text: string; toolCalls: { name: string; label: string }[] }[];
      };
      setConversationId(id);
      setMessages(
        payload.messages.map((message) => ({
          ...message,
          toolCalls: message.toolCalls.map((tool) => ({ ...tool, state: "ok" as const })),
        })),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load this conversation.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    conversationId,
    isStreaming,
    isLoading,
    error,
    send,
    loadConversation,
    reset,
  };
}
