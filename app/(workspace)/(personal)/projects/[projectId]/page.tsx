import { ProjectBoardView } from "@/components/project-board-view";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { projectId } = await params;
  const { task: taskId } = await searchParams;
  return <ProjectBoardView projectId={projectId} taskId={taskId} />;
}
