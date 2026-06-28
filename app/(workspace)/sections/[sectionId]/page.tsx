import { FolderKanban, FolderTree, Info } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateSectionDialog } from "@/components/create-section-dialog";
import { SectionBoard } from "@/components/section-board";
import { TaskDetailsSheet } from "@/components/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { flattenSectionTree, getSectionBoard, getSectionsTree, getTaskForSheet } from "@/lib/data";

export const dynamic = "force-dynamic";

type SectionPageProps = {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function SectionPage({ params, searchParams }: SectionPageProps) {
  const { sectionId } = await params;
  const { task: taskId } = await searchParams;

  const [{ section, lanes }, { tree }] = await Promise.all([
    getSectionBoard(sectionId),
    getSectionsTree(),
  ]);

  const totalTasks = lanes.reduce((sum, lane) => sum + lane.tasks.length, 0);
  const sheet = taskId ? await getTaskForSheet(taskId) : null;
  const sectionOptions = flattenSectionTree(tree);

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1 text-foreground" />
              <span>Sections</span>
              <span>/</span>
              <span className="text-foreground">{section.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{section.name}</h1>
              <Badge variant="secondary">{totalTasks} cards</Badge>
            </div>
            <p className="inline-flex max-w-3xl items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="size-3.5 shrink-0" />
              {section.description?.trim() ||
                "Combined board of every card across this section and its sub-sections. Open a card to edit it in its project."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateSectionDialog
              sections={sectionOptions}
              defaultParentId={section.id}
              trigger={
                <Button variant="outline" className="w-full justify-center gap-2 sm:w-40">
                  <FolderTree className="size-4 shrink-0" />
                  New Section
                </Button>
              }
            />
            <CreateProjectDialog
              sections={sectionOptions}
              defaultSectionId={section.id}
              trigger={
                <Button className="w-full justify-center gap-2 sm:w-40">
                  <FolderKanban className="size-4 shrink-0" />
                  New Project
                </Button>
              }
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <SectionBoard sectionId={section.id} lanes={lanes} />
      </div>

      {sheet ? (
        <TaskDetailsSheet projectId={sheet.projectId} task={sheet.task} columns={sheet.columns} />
      ) : null}
    </div>
  );
}
