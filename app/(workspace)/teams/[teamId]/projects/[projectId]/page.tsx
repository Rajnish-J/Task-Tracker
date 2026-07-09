import { ProjectBoardView } from "@/components/project-board-view";

export const dynamic = "force-dynamic";

type TeamProjectPageProps = {
  params: Promise<{ teamId: string; projectId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function TeamProjectPage({ params, searchParams }: TeamProjectPageProps) {
  const { teamId, projectId } = await params;
  const { task: taskId } = await searchParams;
  return <ProjectBoardView projectId={projectId} taskId={taskId} teamId={teamId} />;
}
