import { TimelineView } from "@/components/timeline-view";

export const dynamic = "force-dynamic";

type TimelinePageProps = {
  searchParams: Promise<{ task?: string }>;
};

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const { task: taskId } = await searchParams;
  return <TimelineView taskId={taskId} />;
}
