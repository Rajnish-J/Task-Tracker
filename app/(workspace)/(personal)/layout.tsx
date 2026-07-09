import { AppShell } from "@/components/app-shell";
import { flattenSectionTree, getSectionsTree } from "@/lib/data";
import { getUnreadNotificationCount, getUserTeams } from "@/lib/team-data";

export const dynamic = "force-dynamic";

export default async function PersonalWorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ tree, ungroupedProjects }, teams, unreadCount] = await Promise.all([
    getSectionsTree(),
    getUserTeams(),
    getUnreadNotificationCount(),
  ]);
  const sectionOptions = flattenSectionTree(tree);

  return (
    <AppShell
      tree={tree}
      ungroupedProjects={ungroupedProjects}
      sectionOptions={sectionOptions}
      teams={teams}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
