"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Expand, MessageCircle, X } from "lucide-react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useChat } from "@/components/chat/use-chat";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Floating mini-chat available on every workspace page. Hidden on /chat itself
// (the full page owns that surface). Keeps its own conversation state.
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const chat = useChat();

  if (pathname === "/chat") {
    return null;
  }

  return (
    <>
      {open ? (
        <div className="fixed right-4 bottom-4 z-50 flex h-[560px] max-h-[calc(100svh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Assistant</span>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Open full chat page"
                      nativeButton={false}
                      render={<Link href="/chat" />}
                    />
                  }
                >
                  <Expand className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Open full chat</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <ChatPanel
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            error={chat.error}
            onSend={(text) => chat.send(text)}
          />
        </div>
      ) : (
        <Button
          size="icon"
          aria-label="Open assistant chat"
          className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-5" />
        </Button>
      )}
    </>
  );
}
