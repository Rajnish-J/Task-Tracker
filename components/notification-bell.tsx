"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { getNotificationsAction, markAllNotificationsRead } from "@/app/team-actions";
import { NotificationsList, type NotificationItem } from "@/components/notifications-list";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useInterval } from "@/hooks/use-interval";

const POLL_INTERVAL_MS = 15000;

// Notification bell present in both the sidebar footer and (via the
// "header" variant) floating in the top-right of every page. Shows the
// unread count from the layout; the list itself is fetched when the sheet
// opens so page loads stay light, and then polled in the background so
// invites/updates from other users show up without a reload.
export function NotificationBell({
  unreadCount,
  variant = "sidebar",
}: {
  unreadCount: number;
  variant?: "sidebar" | "header";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [statuses, setStatuses] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const result = await getNotificationsAction();
    setItems(result.notifications as NotificationItem[]);
    setStatuses(result.invitationStatuses);
  }, []);

  useInterval(() => void load(), POLL_INTERVAL_MS);

  const liveUnreadCount = items
    ? items.filter((item) => !item.readAt).length
    : unreadCount;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await load();
    router.refresh();
  };

  const badge =
    liveUnreadCount > 0 ? (
      <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold leading-none text-primary-foreground">
        {liveUnreadCount > 9 ? "9+" : liveUnreadCount}
      </span>
    ) : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {variant === "header" ? (
        <SheetTrigger
          render={
            <Button
              variant="secondary"
              size="icon"
              aria-label="Notifications"
              className="relative rounded-full shadow-md"
            />
          }
        >
          <Bell className="size-4" />
          {badge}
        </SheetTrigger>
      ) : (
        <SheetTrigger render={<SidebarMenuButton tooltip="Notifications" />}>
          <span className="relative flex size-4 items-center justify-center">
            <Bell className="size-4" />
            {badge}
          </span>
          <span>Notifications</span>
        </SheetTrigger>
      )}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 rounded-xl border sm:max-w-md data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:h-auto data-[side=right]:max-h-[75vh]"
      >
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Team invitations and membership updates.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-end border-b border-border/60 px-4 pb-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={liveUnreadCount === 0}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-2">
            {items === null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <NotificationsList
                notifications={items}
                invitationStatuses={statuses}
                onChanged={() => void load()}
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
