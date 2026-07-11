"use client";

import * as React from "react";
import { ListChecks } from "lucide-react";

import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { Badge } from "@/components/ui/badge";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { CURRENT_VERSION } from "@/lib/changelog";

const SEEN_VERSION_KEY = "changelog-last-seen-version";

// No cross-tab/live updates needed — this component is the only writer, and
// it re-renders itself (via setOpen) right after writing — so the subscribe
// callback is never actually invoked.
function subscribe() {
  return () => {};
}

function getSnapshot() {
  return localStorage.getItem(SEEN_VERSION_KEY) !== CURRENT_VERSION;
}

function getServerSnapshot() {
  return false;
}

// Static app-identity row in the sidebar header: name + version pill. Clicking
// it opens the release history and marks the current version as seen, which
// clears the "unseen release" dot on the pill.
export function VersionBadgeButton() {
  const [open, setOpen] = React.useState(false);
  // useSyncExternalStore (not a lazy useState initializer) so the SSR pass and
  // the client's first render agree on `false` — reading localStorage directly
  // during a client render would mismatch the server-rendered HTML.
  const hasUnseen = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION);
    }
  };

  return (
    <>
      <SidebarMenuButton size="lg" onClick={() => handleOpenChange(true)}>
        <ListChecks className="size-4 text-primary" />
        <span className="flex-1 truncate font-medium">Task Tracker</span>
        <span className="relative">
          <Badge variant="outline" className="font-mono text-[10px]">
            v{CURRENT_VERSION}
          </Badge>
          {hasUnseen ? (
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
          ) : null}
        </span>
      </SidebarMenuButton>
      <WhatsNewDialog open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
