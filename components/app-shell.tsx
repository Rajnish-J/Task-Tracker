import { AppSidebar } from "@/components/app-sidebar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { SpaceProvider } from "@/components/space-context";
import type { SwitcherTeam } from "@/components/space-switcher";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { SectionNode, SectionProject } from "@/lib/data";

type AppShellProps = {
  children: React.ReactNode;
  tree: SectionNode[];
  ungroupedProjects: SectionProject[];
  sectionOptions: { id: string; label: string }[];
  // Active space: personal (teamId null) or a team the user belongs to.
  teamId?: string | null;
  role?: "owner" | "member" | null;
  teams: SwitcherTeam[];
  unreadCount: number;
};

export function AppShell({
  children,
  tree,
  ungroupedProjects,
  sectionOptions,
  teamId = null,
  role = null,
  teams,
  unreadCount,
}: AppShellProps) {
  return (
    <SpaceProvider teamId={teamId} role={role}>
      <SidebarProvider defaultOpen>
        <AppSidebar
          tree={tree}
          ungroupedProjects={ungroupedProjects}
          sectionOptions={sectionOptions}
          teams={teams}
          unreadCount={unreadCount}
        />
        <SidebarInset className="min-h-svh min-w-0 overflow-hidden">{children}</SidebarInset>
        {/* The chat assistant operates on personal data only. */}
        {teamId ? null : <ChatWidget />}
      </SidebarProvider>
    </SpaceProvider>
  );
}
