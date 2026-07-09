import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

type TeamDashboardPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tag?: string }>;
};

export default async function TeamDashboardPage({ params, searchParams }: TeamDashboardPageProps) {
  const { teamId } = await params;
  const { tag: selectedTagId } = await searchParams;
  return <DashboardView selectedTagId={selectedTagId} teamId={teamId} />;
}
