"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FolderKanban, LayoutDashboard } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ModeToggle } from "@/components/mode-toggle";
import { NavProjects } from "@/components/nav-projects";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  projects: {
    id: string;
    name: string;
    slug: string;
    columns: { id: string }[];
    _count: { tasks: number };
  }[];
};

export function AppSidebar({ projects, ...props }: AppSidebarProps) {
  const params = useParams<{ projectId?: string }>();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[active=true]:bg-sidebar-accent"
              render={<Link href="/" />}
              isActive={!params?.projectId}
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
        <CreateProjectDialog
          trigger={
            <Button className="w-full justify-start gap-2">
              <FolderKanban className="size-4" />
              New Project
            </Button>
          }
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" />} tooltip="All projects">
                  <LayoutDashboard className="size-4" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavProjects currentProjectId={params?.projectId} projects={projects} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
