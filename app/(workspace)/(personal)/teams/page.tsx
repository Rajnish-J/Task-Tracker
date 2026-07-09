import { TeamsView } from "@/components/teams-view";
import { getTeamsOverview } from "@/lib/team-data";

export const dynamic = "force-dynamic";

type TeamsPageProps = {
  searchParams: Promise<{ create?: string }>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const { create } = await searchParams;
  const overview = await getTeamsOverview();
  return <TeamsView overview={overview} autoOpenCreate={create === "1"} />;
}
