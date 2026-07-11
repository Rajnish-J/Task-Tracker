"use client";

import { Sparkles } from "lucide-react";

import { CHANGELOG, CURRENT_VERSION, type ReleaseBadge } from "@/lib/changelog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Same literal accent-class strings as lib/constants.ts's COLUMN_ACCENT_META
// (kept as full literals here, not derived, so Tailwind's static scanner
// generates them regardless of which module happens to import the constant).
const BADGE_STYLES: Record<ReleaseBadge, string> = {
  New: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  Fixed: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  Changed: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
};

export function WhatsNewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            What&apos;s new in Task Tracker
          </DialogTitle>
          <DialogDescription>
            You&apos;re on version <code className="font-mono">v{CURRENT_VERSION}</code>. Here&apos;s
            everything that&apos;s changed recently.
          </DialogDescription>
        </DialogHeader>
        <ol className="thin-scrollbar -mx-1 flex-1 space-y-5 overflow-y-auto px-1 py-1">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="relative border-l border-border pl-4">
              <span className="absolute top-1.5 left-0 size-2 -translate-x-1/2 rounded-full bg-foreground" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">v{entry.version}</span>
                {entry.version === CURRENT_VERSION ? <Badge>Current</Badge> : null}
                <Badge className={BADGE_STYLES[entry.badge]}>+ {entry.badge}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium">{entry.title}</p>
              {entry.details?.length ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
