import { SectionBoardView } from "@/components/section-board-view";

export const dynamic = "force-dynamic";

type SectionPageProps = {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function SectionPage({ params, searchParams }: SectionPageProps) {
  const { sectionId } = await params;
  const { task: taskId } = await searchParams;
  return <SectionBoardView sectionId={sectionId} taskId={taskId} />;
}
