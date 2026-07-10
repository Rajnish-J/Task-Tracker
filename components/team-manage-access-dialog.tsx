"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import { grantMemberPermissions, revokeMemberPermissions } from "@/app/team-permission-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_PROJECTS_SCOPE, type Action, type Resource } from "@/lib/db/schema";
import { initials } from "@/lib/utils/initials";
import type { TeamDetail } from "@/lib/team-data";

import { PermissionGrid, type PermissionKey, permissionKey } from "@/components/team-permission-grid";

type Member = TeamDetail["members"][number];
type TeamProject = TeamDetail["projects"][number];
type TeamSection = TeamDetail["sections"][number];

// Nested scope -> permission-set grid for a single member, as stored in
// TeamDetail["memberPermissions"][userId] (plain-object form of the server's
// Map<scope, Set<PermissionKey>>, scope being "*" or a projectId). Values are
// `string[]` at the TeamDetail boundary (server-serialized); narrowed to
// PermissionKey when rehydrated below, since the DB only ever stores valid pairs.
type MemberGrid = Record<string, string[]>;

function buildSectionChildren(sections: TeamSection[]) {
  const byParent = new Map<string | null, TeamSection[]>();
  for (const section of sections) {
    const list = byParent.get(section.parentId) ?? [];
    list.push(section);
    byParent.set(section.parentId, list);
  }
  return byParent;
}

function buildProjectsBySection(projects: TeamProject[]) {
  const bySection = new Map<string | null, TeamProject[]>();
  for (const project of projects) {
    const list = bySection.get(project.sectionId) ?? [];
    list.push(project);
    bySection.set(project.sectionId, list);
  }
  return bySection;
}

export function TeamManageAccessDialog({
  open,
  onOpenChange,
  teamId,
  member,
  initialGrid,
  projects,
  sections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  member: Member;
  initialGrid: MemberGrid;
  projects: TeamProject[];
  sections: TeamSection[];
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  // `initialGrid` is only read on mount — the parent remounts this component
  // (via a `key={member.user.id}` on the caller) whenever the managed member
  // changes, so this never goes stale across members. Toggles below keep
  // `grid` in sync locally without needing to resync from props.
  const [grid, setGrid] = React.useState(() => rehydrate(initialGrid));

  const [expandedProjectIds, setExpandedProjectIds] = React.useState<Set<string>>(new Set());

  function scopeSet(scope: string): Set<PermissionKey> {
    return grid.get(scope) ?? new Set();
  }

  function toggle(scope: string, resource: Resource, action: Action, next: boolean) {
    const key = permissionKey(resource, action);
    setGrid((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(scope) ?? []);
      if (next) set.add(key);
      else set.delete(key);
      copy.set(scope, set);
      return copy;
    });

    startTransition(async () => {
      try {
        const run = next ? grantMemberPermissions : revokeMemberPermissions;
        await run({
          teamId,
          userIds: [member.user.id],
          pairs: [{ resource, action }],
          projectId: scope === ALL_PROJECTS_SCOPE ? undefined : scope,
        });
        router.refresh();
      } catch {
        setGrid((prev) => {
          const copy = new Map(prev);
          const set = new Set(copy.get(scope) ?? []);
          if (next) set.delete(key);
          else set.add(key);
          copy.set(scope, set);
          return copy;
        });
      }
    });
  }

  function toggleExpanded(projectId: string) {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  const childrenBySection = React.useMemo(() => buildSectionChildren(sections), [sections]);
  const projectsBySection = React.useMemo(() => buildProjectsBySection(projects), [projects]);

  function renderProjectRow(project: TeamProject, depth: number) {
    const expanded = expandedProjectIds.has(project.id);
    return (
      <div key={project.id} className="border-t first:border-t-0">
        <button
          type="button"
          onClick={() => toggleExpanded(project.id)}
          className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-muted/40"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{project.name}</span>
        </button>
        {expanded ? (
          <div className="bg-muted/20 px-4 py-3" style={{ paddingLeft: `${depth * 16 + 32}px` }}>
            <p className="mb-2 text-xs text-muted-foreground">
              Additional grants for this project only, on top of the Default Permissions tab.
            </p>
            <PermissionGrid
              checked={(resource, action) => scopeSet(project.id).has(permissionKey(resource, action))}
              onToggle={(resource, action, next) => toggle(project.id, resource, action, next)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  function renderSection(sectionId: string | null, depth: number): React.ReactNode {
    const childSections = childrenBySection.get(sectionId) ?? [];
    const sectionProjects = projectsBySection.get(sectionId) ?? [];
    if (childSections.length === 0 && sectionProjects.length === 0) return null;

    return (
      <React.Fragment key={sectionId ?? "root"}>
        {childSections.map((section) => (
          <div key={section.id} className="border-t first:border-t-0">
            <div
              className="py-2 text-xs font-medium text-muted-foreground"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {section.name}
            </div>
            {renderSection(section.id, depth + 1)}
          </div>
        ))}
        {sectionProjects.map((project) => renderProjectRow(project, depth))}
      </React.Fragment>
    );
  }

  const tree = renderSection(null, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {member.user.image ? (
                <AvatarImage src={member.user.image} alt={member.user.name} />
              ) : null}
              <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle>Manage Access — {member.user.name}</DialogTitle>
              <DialogDescription>{member.user.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="default">
          <TabsList>
            <TabsTrigger value="default">Default Permissions</TabsTrigger>
            <TabsTrigger value="projects">Project Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="default" className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Applies to every project in this team unless a project below grants more.
            </p>
            <PermissionGrid
              checked={(resource, action) =>
                scopeSet(ALL_PROJECTS_SCOPE).has(permissionKey(resource, action))
              }
              onToggle={(resource, action, next) =>
                toggle(ALL_PROJECTS_SCOPE, resource, action, next)
              }
            />
          </TabsContent>

          <TabsContent value="projects" className="pt-2">
            {tree ? (
              <div className="thin-scrollbar max-h-80 overflow-y-auto rounded-md border">{tree}</div>
            ) : (
              <p className="text-sm text-muted-foreground">This team has no projects yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function rehydrate(memberGrid: MemberGrid): Map<string, Set<PermissionKey>> {
  const map = new Map<string, Set<PermissionKey>>();
  for (const [scope, pairs] of Object.entries(memberGrid)) {
    map.set(scope, new Set(pairs as PermissionKey[]));
  }
  return map;
}
