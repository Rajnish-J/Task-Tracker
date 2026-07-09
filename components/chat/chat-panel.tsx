"use client";

import * as React from "react";
import { ArrowUp, Check, CircleAlert, Loader2, Sparkles, X } from "lucide-react";

import type { ChatMessageView, ToolChip } from "@/components/chat/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Dependency-free inline formatter: **bold** and `code` spans only.
function formatInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function ToolChipBadge({ chip }: { chip: ToolChip }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-normal",
        chip.state === "error" && "text-destructive",
      )}
    >
      {chip.state === "running" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : chip.state === "ok" ? (
        <Check className="size-3" />
      ) : (
        <X className="size-3" />
      )}
      {chip.label}
    </Badge>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessageView; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.toolCalls.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {message.toolCalls.map((chip, index) => (
              <ToolChipBadge key={`${chip.name}-${index}`} chip={chip} />
            ))}
          </div>
        ) : null}
        {message.text || streaming ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {formatInline(message.text)}
            {streaming ? (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-foreground/70 align-text-bottom" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ChatPanelProps = {
  messages: ChatMessageView[];
  isStreaming: boolean;
  isLoading?: boolean;
  error: string | null;
  onSend: (text: string) => void;
  placeholder?: string;
  emptyState?: React.ReactNode;
  composerAccessory?: React.ReactNode;
  className?: string;
};

// The shared conversation surface used by both the /chat page and the floating
// widget: scrollable message list + composer.
export function ChatPanel({
  messages,
  isStreaming,
  isLoading,
  error,
  onSend,
  placeholder = "Ask about your workspace…",
  emptyState,
  composerAccessory,
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isStreaming]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft("");
    onSend(text);
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scrollRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          emptyState ?? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Sparkles className="size-5" />
              <p>Ask me to create, update or move tasks on your boards.</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streaming={isStreaming && message === lastMessage && message.role === "assistant"}
              />
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
          {composerAccessory}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon-sm"
            onClick={submit}
            disabled={!draft.trim() || isStreaming}
            aria-label="Send message"
          >
            {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
