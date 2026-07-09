import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Button } from "@/components/ui/button";
import { getProjects } from "@/lib/data";
import { getSpaceContext } from "@/lib/space";

export const dynamic = "force-dynamic";

type TeamHomePageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamHomePage({ params }: TeamHomePageProps) {
  const { teamId } = await params;
  const [space, projects] = await Promise.all([getSpaceContext(teamId), getProjects(teamId)]);

  if (projects[0]) {
    redirect(`/teams/${teamId}/projects/${projects[0].id}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_35%)] p-6">
      <div className="w-full max-w-2xl rounded-lg border border-border/60 bg-card p-10 shadow-sm">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Team workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {space.role === "owner"
              ? "Create your team's first project board"
              : "No projects yet"}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            {space.role === "owner"
              ? "Each project gets its own Kanban workflow, custom columns, task cards, and a detail panel your whole team can work in."
              : "The team owner hasn't created any projects yet. Once they do, boards will show up here for everyone."}
          </p>
          {space.role === "owner" ? (
            <CreateProjectDialog
              trigger={
                <Button size="lg">
                  <FolderKanban className="size-4" />
                  Create project
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
