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

// Notification bell in the sidebar (the one piece of chrome present on every
// page in both spaces). Shows the unread count from the layout; the list
// itself is fetched when the sheet opens so page loads stay light.
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [statuses, setStatuses] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const result = await getNotificationsAction();
    setItems(result.notifications as NotificationItem[]);
    setStatuses(result.invitationStatuses);
  }, []);

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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<SidebarMenuButton tooltip="Notifications" />}>
        <span className="relative flex size-4 items-center justify-center">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
        <span>Notifications</span>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
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
            disabled={unreadCount === 0}
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
