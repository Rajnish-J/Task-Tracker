import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, Users } from "lucide-react";

import { CreateTeamDialog } from "@/components/create-team-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TEAM_COLOR_META, TEAM_CREATION_LIMIT } from "@/lib/constants";
import type { getTeamsOverview } from "@/lib/team-data";

type TeamsOverview = Awaited<ReturnType<typeof getTeamsOverview>>;

// Teams overview: every team the user belongs to, plus the create flow.
export function TeamsView({
  overview,
  autoOpenCreate,
}: {
  overview: TeamsOverview;
  autoOpenCreate?: boolean;
}) {
  const { teams, canCreateTeam } = overview;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1 text-foreground" />
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground">Teams</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
              <Badge variant="secondary">{teams.length} teams</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Shared workspaces with their own projects, sections and boards. Switch spaces any
              time from the sidebar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateTeamDialog canCreateTeam={canCreateTeam} defaultOpen={autoOpenCreate} />
          </div>
        </div>
        {!canCreateTeam ? (
          <p className="mt-3 text-xs text-muted-foreground">
            You&apos;ve reached the limit of {TEAM_CREATION_LIMIT} created teams. Delete a team you
            own to free a slot.
          </p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {teams.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md space-y-3 rounded-lg border border-dashed border-border/60 p-10 text-center">
              <Users className="mx-auto size-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No teams yet</h2>
              <p className="text-sm text-muted-foreground">
                Create a team to collaborate on shared boards, or accept an invitation from the
                notification bell when a teammate invites you.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const swatch = team.color ? TEAM_COLOR_META[team.color]?.swatch : undefined;
              return (
                <Card key={team.id} className="relative transition hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ${swatch ?? "bg-primary"}`}
                      >
                        {team.name.slice(0, 1).toUpperCase()}
                      </span>
                      <Link href={`/teams/${team.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {team.name}
                        <span className="absolute inset-0" aria-hidden />
                      </Link>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {team.description?.trim() || "No description yet."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={team.role === "owner" ? "default" : "secondary"}>
                        {team.role}
                      </Badge>
                      <span>
                        {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span>·</span>
                      <span>Created {format(team.createdAt, "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
