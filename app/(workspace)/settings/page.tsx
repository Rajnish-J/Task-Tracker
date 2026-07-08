import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SettingsView } from "@/components/settings-view";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/login");
  }

  const [sessions, accounts] = await Promise.all([
    auth.api.listSessions({ headers: hdrs }).catch(() => []),
    auth.api.listUserAccounts({ headers: hdrs }).catch(() => []),
  ]);

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
    />
  );
}
