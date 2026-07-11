"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  MoonStar,
  Smartphone,
  SunMedium,
  Trash2,
} from "lucide-react";

import { deleteTag } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { HeaderBreadcrumb } from "@/components/header-slots";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import type { Tag } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useTaskDefaults } from "@/hooks/use-task-defaults";
import { useWeekStartsOn } from "@/hooks/use-week-starts-on";

type SessionRow = {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date | string;
};

type AccountRow = {
  provider: string;
  createdAt: Date | string;
};

type SettingsViewProps = {
  user: {
    name: string;
    email: string;
    image: string | null;
    createdAt: Date | string;
  };
  currentSessionToken: string;
  sessions: SessionRow[];
  accounts: AccountRow[];
  tags: Tag[];
  // Server-rendered notifications card (team invites etc.), slotted in so this
  // component stays focused on account concerns.
  notificationsSlot?: React.ReactNode;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

// Best-effort friendly label for a session's device from its user-agent string.
function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return { label: os ? `${browser} · ${os}` : browser, mobile };
}

function fmtDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d, yyyy");
}

export function SettingsView({
  user,
  currentSessionToken,
  sessions,
  accounts,
  tags,
  notificationsSlot,
}: SettingsViewProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { defaultPriority, defaultTagId, setDefaultPriority, setDefaultTagId } = useTaskDefaults();
  const { weekStartsOn, setWeekStartsOn } = useWeekStartsOn();

  const [name, setName] = React.useState(user.name ?? "");
  const [savingName, setSavingName] = React.useState(false);
  const [nameStatus, setNameStatus] = React.useState<null | "saved" | "error">(null);

  const [busyToken, setBusyToken] = React.useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const nameDirty = name.trim() !== (user.name ?? "").trim() && name.trim().length > 0;
  const googleConnected = accounts.find((a) => a.provider === "google");
  const otherSessions = sessions.filter((s) => s.token !== currentSessionToken);

  async function handleSaveName() {
    setSavingName(true);
    setNameStatus(null);
    const { error } = await authClient.updateUser({ name: name.trim() });
    setSavingName(false);
    if (error) {
      setNameStatus("error");
      return;
    }
    setNameStatus("saved");
    router.refresh();
  }

  async function handleRevoke(token: string) {
    setBusyToken(token);
    await authClient.revokeSession({ token });
    setBusyToken(null);
    router.refresh();
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    await authClient.revokeOtherSessions();
    setRevokingOthers(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await authClient.deleteUser();
    if (error) {
      setDeleting(false);
      setDeleteError(error.message ?? "Could not delete the account. Please try again.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: SunMedium },
    { value: "dark" as const, label: "Dark", icon: MoonStar },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  const weekStartOptions = [
    { value: 0 as const, label: "Sunday", icon: Calendar },
    { value: 1 as const, label: "Monday", icon: Calendar },
  ];

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <HeaderBreadcrumb>
        <span>Workspace</span>
        <span>/</span>
        <span className="text-foreground">Settings</span>
      </HeaderBreadcrumb>
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage your profile, connected account, active sessions, and appearance.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <Tabs defaultValue="general" className="w-full p-4 md:p-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
      <div className="flex flex-col gap-6">
        {/* Profile header */}
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
              <AvatarFallback className="text-lg">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{user.name || "Account"}</h2>
                <Badge variant="secondary" className="gap-1">
                  <GoogleIcon className="size-3" />
                  Google
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Member since {fmtDate(user.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="displayName"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameStatus(null);
                }}
                placeholder="Your name"
                className="max-w-sm"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input id="email" value={user.email} disabled className="max-w-sm" />
              <p className="text-xs text-muted-foreground">
                Your email is managed by Google and can’t be changed here.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveName} disabled={!nameDirty || savingName}>
                {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
              {nameStatus === "saved" ? (
                <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> Saved
                </span>
              ) : null}
              {nameStatus === "error" ? (
                <span className="text-sm text-destructive">Couldn’t save. Try again.</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Connected accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Sign-in method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <GoogleIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Google</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {googleConnected ? `Connected ${fmtDate(googleConnected.createdAt)}` : "Connected"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active sessions */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Active sessions</CardTitle>
              {otherSessions.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeOthers}
                  disabled={revokingOthers}
                >
                  {revokingOthers ? <Loader2 className="size-4 animate-spin" /> : null}
                  Sign out of all other sessions
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active sessions found.</p>
            ) : (
              sessions.map((s) => {
                const { label, mobile } = describeDevice(s.userAgent);
                const isCurrent = s.token === currentSessionToken;
                const DeviceIcon = mobile ? Smartphone : Laptop;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <DeviceIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{label}</p>
                        {isCurrent ? (
                          <Badge variant="secondary" className="shrink-0">
                            This device
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.ipAddress ? `${s.ipAddress} · ` : ""}
                        Signed in {fmtDate(s.createdAt)}
                      </p>
                    </div>
                    {!isCurrent ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(s.token)}
                        disabled={busyToken === s.token}
                      >
                        {busyToken === s.token ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <LogOut className="size-4" />
                        )}
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Task defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Task defaults</CardTitle>
            <CardDescription>
              Applied automatically when you create a new task or checklist item — saved on this
              device.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default priority</label>
              <Select
                value={defaultPriority}
                onValueChange={(value) => value && setDefaultPriority(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default tag</label>
              <Select
                value={defaultTagId ?? ""}
                onValueChange={(value) => setDefaultTagId(value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No tag</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Week starts on */}
        <Card>
          <CardHeader>
            <CardTitle>Week starts on</CardTitle>
            <CardDescription>
              Controls the first day of the week shown in the Timeline&apos;s week view — saved on
              this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-lg border border-border/60 p-1">
              {weekStartOptions.map((option) => {
                const active = weekStartsOn === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWeekStartsOn(option.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={active}
                  >
                    <option.icon className="size-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and every project, board, and task you own.
                This cannot be undone.
              </p>
            </div>
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="destructive" className="shrink-0 gap-2">
                    <Trash2 className="size-4" />
                    Delete account
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This removes your account and all of your data permanently. Type{" "}
                    <span className="font-medium text-foreground">{user.email}</span> to confirm.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={user.email}
                  autoComplete="off"
                />
                {deleteError ? (
                  <p className="text-sm text-destructive">{deleteError}</p>
                ) : null}
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting || confirmEmail.trim() !== user.email}
                  >
                    {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Delete account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="tags">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              Tags you&apos;ve created across projects and tasks. Deleting one removes it from
              anything it&apos;s applied to, without deleting those items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                {tags.map((tag) => (
                  <li key={tag.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <TagBadge tag={tag} />
                    <ActionForm
                      action={deleteTag}
                      successMessage={`Deleted "${tag.name}"`}
                      errorMessage="Couldn't delete tag. Please try again."
                    >
                      <input type="hidden" name="tagId" value={tag.id} />
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        pendingLabel="Deleting…"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="appearance">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how the app looks on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-lg border border-border/60 p-1">
              {themeOptions.map((option) => {
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={active}
                  >
                    <option.icon className="size-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="notifications">
      <div className="flex flex-col gap-6">
        {notificationsSlot}
      </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
