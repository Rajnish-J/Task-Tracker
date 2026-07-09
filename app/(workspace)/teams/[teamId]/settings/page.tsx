import { TeamSettingsView } from "@/components/team-settings-view";
import { getTeam } from "@/lib/team-data";

export const dynamic = "force-dynamic";

type TeamSettingsPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamSettingsPage({ params }: TeamSettingsPageProps) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return <TeamSettingsView team={team} />;
}
