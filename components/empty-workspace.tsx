import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Button } from "@/components/ui/button";

export function EmptyWorkspace() {
  return (
    <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_35%)] p-6">
      <div className="w-full max-w-2xl rounded-lg border border-border/60 bg-card p-10 shadow-sm">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Phase One Workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Create your first project board</h1>
          <p className="max-w-xl text-muted-foreground">
            Each project gets its own Kanban workflow, custom columns, task cards, and a detail panel
            for notes, descriptions, due dates, and priority management.
          </p>
          <CreateProjectDialog trigger={<Button size="lg">Create project</Button>} />
        </div>
      </div>
    </div>
  );
}
