"use client";

import * as React from "react";

import { ChatHero } from "@/components/chat/chat-hero";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConversationList } from "@/components/chat/conversation-list";
import { ToolsPopover } from "@/components/chat/tools-popover";
import { useChat } from "@/components/chat/use-chat";
import { TOOL_CATALOG } from "@/lib/ai/tool-catalog";

const ALL_TOOL_NAMES = TOOL_CATALOG.flatMap((group) => group.tools.map((tool) => tool.name));

// The /chat page: conversation rail + (hero when empty | conversation panel).
export function ChatPage() {
  const [listRefreshKey, setListRefreshKey] = React.useState(0);
  const chat = useChat({
    onConversationCreated: () => setListRefreshKey((key) => key + 1),
  });
  // Names the user switched OFF in the Tools popover (default: none).
  const [disabledTools, setDisabledTools] = React.useState<Set<string>>(new Set());

  const enabledTools = React.useMemo(
    () =>
      // Omit the field entirely when everything is enabled — keeps the
      // request (and the server's prompt cache) on the default tool set.
      disabledTools.size === 0
        ? undefined
        : ALL_TOOL_NAMES.filter((name) => !disabledTools.has(name)),
    [disabledTools],
  );

  const send = (text: string) => chat.send(text, enabledTools);

  const toolsPopover = (
    <ToolsPopover
      catalog={TOOL_CATALOG}
      disabledTools={disabledTools}
      onToggle={(name, enabled) =>
        setDisabledTools((current) => {
          const next = new Set(current);
          if (enabled) next.delete(name);
          else next.add(name);
          return next;
        })
      }
    />
  );

  const showHero = chat.messages.length === 0 && !chat.isLoading && !chat.conversationId;

  return (
    <div className="flex h-svh min-w-0 flex-1">
      <ConversationList
        activeId={chat.conversationId}
        refreshKey={listRefreshKey}
        onSelect={(id) => chat.loadConversation(id)}
        onNew={() => chat.reset()}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {showHero ? (
          <ChatHero onSubmit={send} composerAccessory={toolsPopover} />
        ) : (
          <ChatPanel
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            isLoading={chat.isLoading}
            error={chat.error}
            onSend={send}
            composerAccessory={toolsPopover}
          />
        )}
      </div>
    </div>
  );
}
