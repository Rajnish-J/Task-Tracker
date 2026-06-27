"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FolderKanban, FolderTree } from "lucide-react";

import { ProjectRowMenu } from "@/components/project-row-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { SectionNode } from "@/lib/data";

const INDENT = 12;

export function NavSections({
  tree,
  sections,
  currentSectionId,
  currentProjectId,
}: {
  tree: SectionNode[];
  sections: { id: string; label: string }[];
  currentSectionId?: string;
  currentProjectId?: string;
}) {
  if (tree.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Sections</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {tree.map((node) => (
            <SectionRow
              key={node.id}
              node={node}
              depth={0}
              sections={sections}
              currentSectionId={currentSectionId}
              currentProjectId={currentProjectId}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SectionRow({
  node,
  depth,
  sections,
  currentSectionId,
  currentProjectId,
}: {
  node: SectionNode;
  depth: number;
  sections: { id: string; label: string }[];
  currentSectionId?: string;
  currentProjectId?: string;
}) {
  const [open, setOpen] = React.useState(true);
  const hasChildren = node.children.length > 0 || node.projects.length > 0;
  const buttonPadding = depth * INDENT + (hasChildren ? 22 : 8);

  return (
    <>
      <SidebarMenuItem>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => setOpen((value) => !value)}
            style={{ left: depth * INDENT + 2 }}
            className="absolute top-1.5 z-10 flex size-5 items-center justify-center rounded text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          </button>
        ) : null}
        <SidebarMenuButton
          render={<Link href={`/sections/${node.id}`} />}
          isActive={currentSectionId === node.id}
          tooltip={node.name}
          style={{ paddingLeft: buttonPadding }}
        >
          <FolderTree className="size-4" />
          <span>{node.name}</span>
        </SidebarMenuButton>
        <SidebarMenuBadge>{node.taskCount}</SidebarMenuBadge>
      </SidebarMenuItem>

      {open && hasChildren ? (
        <>
          {node.children.map((child) => (
            <SectionRow
              key={child.id}
              node={child}
              depth={depth + 1}
              sections={sections}
              currentSectionId={currentSectionId}
              currentProjectId={currentProjectId}
            />
          ))}
          {node.projects.map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                render={<Link href={`/projects/${project.id}`} />}
                isActive={currentProjectId === project.id}
                tooltip={project.name}
                className="pr-16"
                style={{ paddingLeft: (depth + 1) * INDENT + 8 }}
              >
                <FolderKanban className="size-4" />
                <span>{project.name}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge className="right-8">{project.taskCount}</SidebarMenuBadge>
              <ProjectRowMenu
                project={project}
                sections={sections}
                currentSectionId={node.id}
              />
            </SidebarMenuItem>
          ))}
        </>
      ) : null}
    </>
  );
}
