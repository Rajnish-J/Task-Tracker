import { TimelineView } from "@/components/timeline-view";

export const dynamic = "force-dynamic";

type TeamTimelinePageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function TeamTimelinePage({ params, searchParams }: TeamTimelinePageProps) {
  const { teamId } = await params;
  const { task: taskId } = await searchParams;
  return <TimelineView taskId={taskId} teamId={teamId} />;
}
