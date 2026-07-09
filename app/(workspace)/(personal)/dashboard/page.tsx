import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{ tag?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tag: selectedTagId } = await searchParams;
  return <DashboardView selectedTagId={selectedTagId} />;
}
