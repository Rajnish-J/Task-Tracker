"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getNotificationsAction, markAllNotificationsRead } from "@/app/team-actions";
import { NotificationsList, type NotificationItem } from "@/components/notifications-list";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInterval } from "@/hooks/use-interval";

const POLL_INTERVAL_MS = 15000;

// Notification drawer, opened from the "Notifications" item in the profile
// dropdown (NavUser). Controlled from there so the sheet survives the
// dropdown menu closing on item click. The list itself is fetched when the
// sheet opens so page loads stay light, and then polled in the background so
// invites/updates from other users show up without a reload.
export function NotificationBell({
  unreadCount,
  open,
  onOpenChange,
}: {
  unreadCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
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
    onOpenChange(next);
    if (next) void load();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await load();
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
