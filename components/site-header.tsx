"use client";

import { HeaderNotificationBell } from "@/components/header-notification-bell";
import { useHeaderSlots } from "@/components/header-slots";
import { SidebarTrigger } from "@/components/ui/sidebar";

// App-wide top bar, sticky above every page's own content. Owns the sidebar
// toggle and the current page's breadcrumb (published via HeaderBreadcrumb),
// plus notifications and any page-specific trailing action (HeaderTrailing).
export function SiteHeader({
  unreadCount,
}: {
  basePath: string;
  unreadCount: number;
}) {
  const { breadcrumb, trailing } = useHeaderSlots();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 text-foreground" />
        {breadcrumb ? (
          <div className="flex min-w-0 items-center gap-2 truncate border-l border-border/60 pl-3 text-sm text-muted-foreground">
            {breadcrumb}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <HeaderNotificationBell unreadCount={unreadCount} />
        {trailing}
      </div>
    </header>
  );
}
