"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Check, Mail, Trash2, UserMinus, UserPlus, X } from "lucide-react";

import { markNotificationRead, respondToInvitation } from "@/app/team-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationPayload, NotificationType } from "@/lib/db/schema";

export type NotificationItem = {
  id: string;
  type: string;
  payload: NotificationPayload;
  readAt: Date | string | null;
  createdAt: Date | string;
};

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  team_invite: Mail,
  invite_accepted: UserPlus,
  invite_declined: UserMinus,
  member_removed: UserMinus,
  team_deleted: Trash2,
};

function messageFor(item: NotificationItem): string {
  const actor = item.payload.actorName || item.payload.actorEmail || "Someone";
  const team = item.payload.teamName || "a team";
  switch (item.type as NotificationType) {
    case "team_invite":
      return `${actor} invited you to join ${team}.`;
    case "invite_accepted":
      return `${actor} accepted your invitation to ${team}.`;
    case "invite_declined":
      return `${actor} declined your invitation to ${team}.`;
    case "member_removed":
      return `You were removed from ${team} by ${actor}.`;
    case "team_deleted":
      return `${team} was deleted by ${actor}.`;
    default:
      return "You have a new notification.";
  }
}

// Shared notification list, rendered inside the bell sheet and on the
// Settings page. For pending team invites it shows Accept / Decline inline;
// resolved invites collapse to their outcome.
export function NotificationsList({
  notifications,
  invitationStatuses,
  onChanged,
}: {
  notifications: NotificationItem[];
  invitationStatuses: Record<string, string>;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (notifications.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        No notifications yet. Team invitations and updates will show up here.
      </p>
    );
  }

  const respond = async (item: NotificationItem, accept: boolean) => {
    const invitationId = item.payload.invitationId;
    if (!invitationId) return;
    setPendingId(item.id);
    try {
      await respondToInvitation({ invitationId, accept });
      router.refresh();
      onChanged?.();
    } finally {
      setPendingId(null);
    }
  };

  const markRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    await markNotificationRead({ notificationId: item.id });
    router.refresh();
    onChanged?.();
  };

  return (
    <ul className="divide-y divide-border/60">
      {notifications.map((item) => {
        const Icon = TYPE_ICONS[item.type as NotificationType] ?? Mail;
        const invitationStatus = item.payload.invitationId
          ? invitationStatuses[item.payload.invitationId]
          : undefined;
        const isActionableInvite = item.type === "team_invite" && invitationStatus === "pending";

        return (
          <li
            key={item.id}
            className={cn("flex gap-3 px-1 py-3", !item.readAt && "bg-primary/[0.04]")}
          >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={cn("text-sm leading-snug", !item.readAt && "font-medium")}>
                {messageFor(item)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </p>
              {isActionableInvite ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={pendingId === item.id}
                    onClick={() => respond(item, true)}
                  >
                    <Check className="size-3.5" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === item.id}
                    onClick={() => respond(item, false)}
                  >
                    <X className="size-3.5" />
                    Decline
                  </Button>
                </div>
              ) : item.type === "team_invite" && invitationStatus && invitationStatus !== "pending" ? (
                <p className="text-xs text-muted-foreground">
                  Invitation {invitationStatus}.
                </p>
              ) : null}
            </div>
            {!item.readAt ? (
              <button
                type="button"
                title="Mark as read"
                className="mt-1 size-2 shrink-0 rounded-full bg-primary transition-opacity hover:opacity-60"
                onClick={() => markRead(item)}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
