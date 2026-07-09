import { AppShell } from "@/components/app-shell";
import { flattenSectionTree, getSectionsTree } from "@/lib/data";
import { getSpaceContext } from "@/lib/space";
import { getUnreadNotificationCount, getUserTeams } from "@/lib/team-data";

export const dynamic = "force-dynamic";

export default async function TeamWorkspaceLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}>) {
  const { teamId } = await params;
  // 404s non-members before any child renders. Every page/action still
  // re-resolves the space itself — this check is UX, not the security boundary.
  const space = await getSpaceContext(teamId);

  const [{ tree, ungroupedProjects }, teams, unreadCount] = await Promise.all([
    getSectionsTree(teamId),
    getUserTeams(),
    getUnreadNotificationCount(),
  ]);
  const sectionOptions = flattenSectionTree(tree);

  return (
    <AppShell
      tree={tree}
      ungroupedProjects={ungroupedProjects}
      sectionOptions={sectionOptions}
      teamId={teamId}
      role={space.role}
      teams={teams}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
