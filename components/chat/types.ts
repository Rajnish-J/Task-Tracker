// Shared view-model types for the chat UI (page + floating widget).

export type ToolChip = {
  name: string;
  label: string;
  state: "running" | "ok" | "error";
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolChip[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
