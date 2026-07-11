"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, LayoutDashboard, Plus, Users } from "lucide-react";

import { useSpace } from "@/components/space-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { TeamIcon } from "@/lib/team-icons";

export type SwitcherTeam = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  role: "owner" | "member";
};

// The team's chosen icon alone (no background swatch), tinted with the
// team's accent color — `team.color` is one of the text-* classes below.
function TeamGlyph({ team, className }: { team: SwitcherTeam; className?: string }) {
  const tint = team.color
    ?.split(" ")
    .filter((cls) => cls.startsWith("text-") || cls.startsWith("dark:text-"))
    .join(" ");
  return (
    <div className={`flex items-center justify-center ${tint || "text-sidebar-foreground"} ${className ?? "size-8"}`}>
      <TeamIcon icon={team.icon} className="size-4" />
    </div>
  );
}

// Vercel-style workspace switcher in the sidebar header: the active space as
// the trigger, then Personal / Teams groups with a check on the active entry
// and a "Create team" tail item.
export function SpaceSwitcher({ teams }: { teams: SwitcherTeam[] }) {
  const { teamId } = useSpace();
  const activeTeam = teams.find((team) => team.id === teamId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          />
        }
      >
        {activeTeam ? (
          <TeamGlyph team={activeTeam} />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <LayoutDashboard className="size-4" />
          </div>
        )}
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{activeTeam ? activeTeam.name : "Personal"}</span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            {activeTeam
              ? activeTeam.role === "owner"
                ? "Team · Owner"
                : "Team · Member"
              : "Task Tracker workspace"}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Personal account</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href="/" />}>
            <LayoutDashboard className="size-4" />
            <span className="flex-1 truncate">Personal</span>
            {!activeTeam ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {teams.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Teams</DropdownMenuLabel>
              {teams.map((team) => (
                <DropdownMenuItem key={team.id} render={<Link href={`/teams/${team.id}`} />}>
                  <TeamGlyph team={team} className="size-5" />
                  <span className="flex-1 truncate">{team.name}</span>
                  {team.id === teamId ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/teams" />}>
          <Users className="size-4" />
          <span className="flex-1 truncate">Manage teams</span>
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/teams?create=1" />}>
          <Plus className="size-4" />
          <span className="flex-1 truncate">Create team</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
