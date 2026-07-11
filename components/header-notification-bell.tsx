"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { getNotificationsAction, markAllNotificationsRead } from "@/app/team-actions";
import { NotificationsList, type NotificationItem } from "@/components/notifications-list";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInterval } from "@/hooks/use-interval";

const POLL_INTERVAL_MS = 15000;

// Compact "what's new" dropdown in the global app header. The fuller drawer
// (with Accept/Decline on invites) still lives behind the sidebar's
// Notifications item (see NotificationBell) — this is the lightweight glance.
export function HeaderNotificationBell({ unreadCount }: { unreadCount: number }) {
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

  const liveUnreadCount = items ? items.filter((item) => !item.readAt).length : unreadCount;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await load();
    router.refresh();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="size-5" />
            {liveUnreadCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold leading-none text-primary-foreground">
                {liveUnreadCount > 9 ? "9+" : liveUnreadCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80 sm:w-96">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {items && liveUnreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-2">
          {items === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bell className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <NotificationsList
              notifications={items}
              invitationStatuses={statuses}
              onChanged={() => void load()}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
