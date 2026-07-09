"use client";

import * as React from "react";
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
import { useRouter } from "next/navigation";
import { FolderKanban, GripVertical } from "lucide-react";
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
import { useSpace } from "@/components/space-context";
import { cn } from "@/lib/utils";
import type { SectionProject as Project } from "@/lib/data";

export function NavProjects({
  currentProjectId,
  projects,
  sections,
}: {
  currentProjectId?: string;
  projects: Project[];
  sections: { id: string; label: string }[];
}) {
  const router = useRouter();
  const { teamId } = useSpace();
  const [items, setItems] = React.useState<Project[]>(projects);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Re-sync with server data whenever anything we render changes — the set,
  // order, names (rename), or task counts — so a revalidate from creating,
  // renaming, reordering, or moving a project replaces the optimistic local
  // copy. Keyed on the displayed fields, not just ids, or renames would be
  // swallowed because the id set is unchanged.
  const signature = React.useMemo(
    () =>
      projects
        .map((project) => `${project.id}:${project.name}:${project.taskCount}`)
        .join("|"),
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

    void reorderProjects(
      { orderedIds: next.map((project) => project.id) },
      teamId ?? undefined,
    ).then(() => router.refresh());
  }

  // Hidden entirely when every project lives in a section — the "Ungrouped"
  // group is only meaningful when there are sectionless projects.
  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Ungrouped</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <DndContext
            id="nav-projects-dnd"
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
                <SortableProjectItem
                  key={project.id}
                  project={project}
                  isActive={currentProjectId === project.id}
                  sections={sections}
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
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SortableProjectItem({
  project,
  isActive,
  sections,
}: {
  project: Project;
  isActive: boolean;
  sections: { id: string; label: string }[];
}) {
  const { basePath } = useSpace();
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
        render={<Link href={`${basePath}/projects/${project.id}`} />}
        isActive={isActive}
        tooltip={project.name}
        className="pr-16"
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
      <ProjectRowMenu project={project} sections={sections} currentSectionId={null} />
    </SidebarMenuItem>
  );
}
