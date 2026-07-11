"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  CalendarRange,
  ChartColumnBig,
  ChevronsDownUp,
  FolderKanban,
  FolderTree,
  MessagesSquare,
  Settings,
} from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateSectionDialog } from "@/components/create-section-dialog";
import { NavProjects } from "@/components/nav-projects";
import { NavSections } from "@/components/nav-sections";
import { NavUser } from "@/components/nav-user";
import { useCanManageStructure, useSpace } from "@/components/space-context";
import { SpaceSwitcher, type SwitcherTeam } from "@/components/space-switcher";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { SectionNode, SectionProject } from "@/lib/data";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  tree: SectionNode[];
  ungroupedProjects: SectionProject[];
  sectionOptions: { id: string; label: string }[];
  teams: SwitcherTeam[];
  unreadCount: number;
};

export function AppSidebar({
  tree,
  ungroupedProjects,
  sectionOptions,
  teams,
  unreadCount,
  ...props
}: AppSidebarProps) {
  const params = useParams<{ projectId?: string; sectionId?: string }>();
  const pathname = usePathname();
  const { teamId, basePath } = useSpace();
  const canManageStructure = useCanManageStructure();
  // Bumping this collapses every expanded section in NavSections.
  const [collapseNonce, setCollapseNonce] = React.useState(0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <SpaceSwitcher teams={teams} />
          </SidebarMenuItem>
        </SidebarMenu>
        {canManageStructure ? (
          <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
            <CreateProjectDialog
              sections={sectionOptions}
              trigger={
                <Button
                  title="New Project"
                  className="w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                >
                  <FolderKanban className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">New Project</span>
                </Button>
              }
            />
            <CreateSectionDialog
              sections={sectionOptions}
              trigger={
                <Button
                  variant="outline"
                  title="New Section"
                  className="w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                >
                  <FolderTree className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">New Section</span>
                </Button>
              }
            />
          </div>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={`${basePath}/dashboard`} />}
              tooltip="Dashboard"
              isActive={pathname === `${basePath}/dashboard`}
            >
              <ChartColumnBig className="size-4" />
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={`${basePath}/timeline`} />}
              tooltip="Timeline"
              isActive={pathname === `${basePath}/timeline`}
            >
              <CalendarRange className="size-4" />
              <span>Timeline</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Chat is personal-only; team members go through their personal space for it. */}
          {teamId ? null : (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/chat" />}
                tooltip="Chat"
                isActive={pathname === "/chat"}
              >
                <MessagesSquare className="size-4" />
                <span>Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {/* Personal "Account settings" already lives in the profile menu (NavUser);
              team settings is distinct (member/invite management), so it keeps its own entry. */}
          {teamId ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href={`${basePath}/settings`} />}
                tooltip="Team settings"
                isActive={pathname === `${basePath}/settings`}
              >
                <Settings className="size-4" />
                <span>Team settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
        <NavSections
          tree={tree}
          sections={sectionOptions}
          currentSectionId={params?.sectionId}
          currentProjectId={params?.projectId}
          collapseNonce={collapseNonce}
        />
        <NavProjects
          currentProjectId={params?.projectId}
          projects={ungroupedProjects}
          sections={sectionOptions}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {tree.length > 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Collapse all"
                className="w-full"
                onClick={() => setCollapseNonce((value) => value + 1)}
              >
                <ChevronsDownUp className="size-4" />
                <span>Collapse all</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <NavUser unreadCount={unreadCount} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
