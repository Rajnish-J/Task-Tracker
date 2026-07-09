import { SectionBoardView } from "@/components/section-board-view";

export const dynamic = "force-dynamic";

type TeamSectionPageProps = {
  params: Promise<{ teamId: string; sectionId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function TeamSectionPage({ params, searchParams }: TeamSectionPageProps) {
  const { teamId, sectionId } = await params;
  const { task: taskId } = await searchParams;
  return <SectionBoardView sectionId={sectionId} taskId={taskId} teamId={teamId} />;
}
