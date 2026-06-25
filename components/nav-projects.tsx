"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

export function NavProjects({
  currentProjectId,
  projects,
}: {
  currentProjectId?: string;
  projects: {
    id: string;
    name: string;
    slug: string;
    columns: { id: string }[];
    _count: { tasks: number };
  }[];
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.length === 0 ? (
            <SidebarMenuItem>
              <div className="rounded-md border border-dashed border-sidebar-border px-3 py-4 text-sm text-sidebar-foreground/70">
                No projects yet.
              </div>
            </SidebarMenuItem>
          ) : null}
          {projects.map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                render={<Link href={`/projects/${project.id}`} />}
                isActive={currentProjectId === project.id}
                tooltip={project.name}
              >
                <FolderKanban className="size-4" />
                <span>{project.name}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{project._count.tasks}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
