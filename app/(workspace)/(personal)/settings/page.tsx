import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NotificationsList } from "@/components/notifications-list";
import { SettingsView } from "@/components/settings-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getNotifications, getPendingInvitationStatuses } from "@/lib/team-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/login");
  }

  const [sessions, accounts, notifications] = await Promise.all([
    auth.api.listSessions({ headers: hdrs }).catch(() => []),
    auth.api.listUserAccounts({ headers: hdrs }).catch(() => []),
    getNotifications(),
  ]);
  const invitationIds = notifications
    .map((row) => row.payload.invitationId)
    .filter((id): id is string => Boolean(id));
  const invitationStatuses = await getPendingInvitationStatuses(invitationIds);

  const notificationsSlot = (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Team invitations and membership updates. Accept or decline invites right here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationsList
          notifications={notifications}
          invitationStatuses={Object.fromEntries(invitationStatuses)}
        />
      </CardContent>
    </Card>
  );

  return (
    <SettingsView
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        createdAt: session.user.createdAt,
      }}
      currentSessionToken={session.session.token}
      sessions={sessions.map((s) => ({
        id: s.id,
        token: s.token,
        userAgent: s.userAgent ?? null,
        ipAddress: s.ipAddress ?? null,
        createdAt: s.createdAt,
      }))}
      accounts={accounts.map((a) => ({
        provider: a.providerId,
        createdAt: a.createdAt,
      }))}
      notificationsSlot={notificationsSlot}
    />
  );
}
