import Link from "next/link";
import { ListChecks } from "lucide-react";

import { HeaderNotificationBell } from "@/components/header-notification-bell";

// App-wide top bar, sticky above every page's own content. Kept deliberately
// minimal (brand + notifications) since each page still renders its own
// breadcrumb/SidebarTrigger header below this.
export function SiteHeader({ basePath, unreadCount }: { basePath: string; unreadCount: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
      <Link
        href={`${basePath}/dashboard`}
        className="flex items-center gap-2 text-sm font-semibold tracking-tight"
      >
        <ListChecks className="size-5 text-primary" />
        Task Tracker
      </Link>
      <HeaderNotificationBell unreadCount={unreadCount} />
    </header>
  );
}
