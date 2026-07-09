"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Info, Plus, Users } from "lucide-react";

import { createTeam } from "@/app/team-actions";
import type { UserSearchResult } from "@/app/team-actions";
import { AccentSelect } from "@/components/accent-select";
import { MemberSearch } from "@/components/member-search";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_COLOR_OPTIONS } from "@/lib/constants";

// Two-step team creation: (1) name/description/color, (2) invite members via
// email search — skippable, with a gentle nudge that inviting is appreciated.
// One <form> spans both steps so every field submits together; steps are just
// show/hide so values persist when navigating back.
export function CreateTeamDialog({
  trigger,
  canCreateTeam = true,
  defaultOpen = false,
}: {
  trigger?: React.ReactElement;
  canCreateTeam?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>(TEAM_COLOR_OPTIONS[0]);
  const [invitees, setInvitees] = React.useState<UserSearchResult[]>([]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setStep(1);
      setName("");
      setInvitees([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button disabled={!canCreateTeam} className="gap-2">
              <Plus className="size-4" />
              New Team
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Create team" : "Invite teammates"}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "A team is a shared workspace: its projects, sections and boards are visible to every member."
              : "Search teammates by email and invite them to join. They'll get an in-app notification to accept or decline."}
          </DialogDescription>
        </DialogHeader>
        <form action={createTeam} className="space-y-4">
          <input type="hidden" name="color" value={color} />
          {invitees.map((user) => (
            <input key={user.id} type="hidden" name="inviteeIds" value={user.id} />
          ))}

          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="team-name">
                Team name <span className="text-destructive">*</span>
              </label>
              <Input
                id="team-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Platform squad"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="team-description">
                Description
              </label>
              <Textarea
                id="team-description"
                name="description"
                placeholder="What does this team work on?"
                maxLength={240}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Accent</label>
              <AccentSelect value={color} onValueChange={setColor} placeholder="Select a team accent" />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={name.trim().length < 2}
                onClick={() => setStep(2)}
                className="gap-2"
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <MemberSearch
              selected={invitees}
              onSelect={(user) => setInvitees((current) => [...current, user])}
              onRemove={(userId) =>
                setInvitees((current) => current.filter((user) => user.id !== userId))
              }
            />
            <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              You can skip this for now and add members later from team settings — but your
              teammates would appreciate an invite.
            </p>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {invitees.length === 0 ? (
                  <SubmitButton variant="outline" pendingLabel="Creating…">
                    Skip &amp; create team
                  </SubmitButton>
                ) : (
                  <SubmitButton pendingLabel="Creating…">
                    <Users className="size-4" />
                    Create team &amp; invite {invitees.length}
                  </SubmitButton>
                )}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
