"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FolderKanban, FolderTree, GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { reorderProjects } from "@/app/actions";
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
import type { SectionNode, SectionProject } from "@/lib/data";

const INDENT = 12;

export function NavSections({
  tree,
  sections,
  currentSectionId,
  currentProjectId,
  collapseNonce,
}: {
  tree: SectionNode[];
  sections: { id: string; label: string }[];
  currentSectionId?: string;
  currentProjectId?: string;
  // Bumped by the sidebar's "Collapse all" control; each row collapses when it
  // changes.
  collapseNonce?: number;
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
              collapseNonce={collapseNonce}
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
  collapseNonce,
}: {
  node: SectionNode;
  depth: number;
  sections: { id: string; label: string }[];
  currentSectionId?: string;
  currentProjectId?: string;
  collapseNonce?: number;
}) {
  const [open, setOpen] = React.useState(true);

  // Collapse this row (and, by unmounting them, its descendants) whenever the
  // sidebar's "Collapse all" nonce changes. Skip the initial mount so rows stay
  // expanded by default.
  const lastNonce = React.useRef(collapseNonce);
  React.useEffect(() => {
    if (lastNonce.current !== collapseNonce) {
      lastNonce.current = collapseNonce;
      setOpen(false);
    }
  }, [collapseNonce]);

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
              collapseNonce={collapseNonce}
            />
          ))}
          <SectionProjects
            sectionId={node.id}
            projects={node.projects}
            depth={depth}
            sections={sections}
            currentProjectId={currentProjectId}
          />
        </>
      ) : null}
    </>
  );
}

// Drag-to-reorder the projects within a single section, mirroring the ungrouped
// list. Each section is its own DnD context, so dragging only reorders within
// that section; moving a project to a different section stays in the row menu.
function SectionProjects({
  sectionId,
  projects,
  depth,
  sections,
  currentProjectId,
}: {
  sectionId: string;
  projects: SectionProject[];
  depth: number;
  sections: { id: string; label: string }[];
  currentProjectId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<SectionProject[]>(projects);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Re-sync with server data whenever the rendered fields change — set, order,
  // names (rename), or task counts — so a revalidate replaces the optimistic copy.
  const signature = React.useMemo(
    () => projects.map((project) => `${project.id}:${project.name}:${project.taskCount}`).join("|"),
    [projects],
  );
  const lastSignature = React.useRef(signature);
  React.useEffect(() => {
    if (lastSignature.current !== signature) {
      setItems(projects);
      lastSignature.current = signature;
    }
  }, [signature, projects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeProject = activeId
    ? items.find((project) => project.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((project) => project.id === active.id);
    const newIndex = items.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    void reorderProjects({ orderedIds: next.map((project) => project.id) }).then(() =>
      router.refresh(),
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <DndContext
      id={`nav-section-${sectionId}-dnd`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((project) => project.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((project) => (
          <SortableSectionProject
            key={project.id}
            project={project}
            depth={depth}
            sections={sections}
            currentProjectId={currentProjectId}
          />
        ))}
      </SortableContext>

      <DragOverlay>
        {activeProject ? (
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-sm shadow-md">
            <FolderKanban className="size-4" />
            <span className="truncate">{activeProject.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableSectionProject({
  project,
  depth,
  sections,
  currentProjectId,
}: {
  project: SectionProject;
  depth: number;
  sections: { id: string; label: string }[];
  currentProjectId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
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
      <button
        type="button"
        aria-label={`Reorder ${project.name}`}
        className={cn(
          "absolute right-14 top-1/2 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded text-sidebar-foreground/50 opacity-0 transition-opacity hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/menu-item:opacity-100 active:cursor-grabbing",
          isDragging && "opacity-100",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <SidebarMenuBadge className="right-8">{project.taskCount}</SidebarMenuBadge>
      <ProjectRowMenu project={project} sections={sections} currentSectionId={project.sectionId} />
    </SidebarMenuItem>
  );
}
