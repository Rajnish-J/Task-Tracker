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
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateSectionDialog } from "@/components/create-section-dialog";
import { ModeToggle } from "@/components/mode-toggle";
import { NavProjects } from "@/components/nav-projects";
import { NavSections } from "@/components/nav-sections";
import { NavUser } from "@/components/nav-user";
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
};

export function AppSidebar({ tree, ungroupedProjects, sectionOptions, ...props }: AppSidebarProps) {
  const params = useParams<{ projectId?: string; sectionId?: string }>();
  const pathname = usePathname();
  // Bumping this collapses every expanded section in NavSections.
  const [collapseNonce, setCollapseNonce] = React.useState(0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[active=true]:bg-sidebar-accent"
              render={<Link href="/" />}
              isActive={!params?.projectId && !params?.sectionId}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <LayoutDashboard className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Task Tracker</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Project Kanban workspace
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              tooltip="Dashboard"
              isActive={pathname === "/dashboard"}
            >
              <ChartColumnBig className="size-4" />
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/timeline" />}
              tooltip="Timeline"
              isActive={pathname === "/timeline"}
            >
              <CalendarRange className="size-4" />
              <span>Timeline</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              tooltip="Settings"
              isActive={pathname === "/settings"}
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
            <ModeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
