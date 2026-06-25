"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChartColumnBig, FolderKanban, LayoutDashboard } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ModeToggle } from "@/components/mode-toggle";
import { NavProjects } from "@/components/nav-projects";
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
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
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
            <Button
              title="New Project"
              className="w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
            >
              <FolderKanban className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">New Project</span>
            </Button>
          }
        />
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
        </SidebarMenu>
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
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChartColumnBig, FolderKanban, LayoutDashboard } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ModeToggle } from "@/components/mode-toggle";
import { NavProjects } from "@/components/nav-projects";
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
  const pathname = usePathname();

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
        </SidebarMenu>
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
