"use client";

import * as React from "react";
import { ArrowUp, CalendarClock, FolderKanban, ListChecks, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATES = [
  {
    icon: FolderKanban,
    label: "Create a project",
    prompt: "Create a new project called ",
    autoSend: false,
  },
  {
    icon: ListChecks,
    label: "Add a task with a checklist",
    prompt: "Add a task to ",
    autoSend: false,
  },
  {
    icon: MoveRight,
    label: "Move a task to another status",
    prompt: "Move the task ",
    autoSend: false,
  },
  {
    icon: CalendarClock,
    label: "What's due this week?",
    prompt: "What tasks are due this week across my boards?",
    autoSend: true,
  },
] as const;

type ChatHeroProps = {
  onSubmit: (text: string) => void;
  composerAccessory?: React.ReactNode;
};

// Empty-conversation hero for the /chat page, modeled on the "Ask anything"
// reference: centered title, big input card, quick-start templates.
export function ChatHero({ onSubmit, composerAccessory }: ChatHeroProps) {
  const [draft, setDraft] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Ask anything</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your boards by describing what you want — I can create, update and move things for you.
        </p>
      </div>

      <Card className="w-full max-w-2xl gap-0 rounded-2xl p-3 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything about your workspace…"
          rows={2}
          className="resize-none border-0 bg-transparent p-2 text-base shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">{composerAccessory}</div>
          <Button size="icon-sm" onClick={submit} disabled={!draft.trim()} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </Card>

      <div className="w-full max-w-2xl">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Quick start with popular actions
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMPLATES.map((template) => (
            <Card
              key={template.label}
              className="cursor-pointer flex-row items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent"
              onClick={() => {
                if (template.autoSend) {
                  onSubmit(template.prompt);
                } else {
                  setDraft(template.prompt);
                  textareaRef.current?.focus();
                }
              }}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <template.icon className="size-4" />
              </div>
              <span className="text-sm font-medium">{template.label}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
