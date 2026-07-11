"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { ModeToggle } from "@/components/mode-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { signOut, useSession } from "@/lib/auth-client";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}

// Signed-in user chip in the sidebar footer, with a dropdown to sign out
// (plus the notifications and theme controls, moved in from the sidebar footer).
export function NavUser({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  if (isPending || !session) {
    return null;
  }

  const { name, email, image } = session.user;

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          />
        }
      >
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt={name ?? email ?? "User"} /> : null}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{name ?? "Account"}</span>
          <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        className="w-(--anchor-width) min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="grid text-left text-sm leading-tight">
              <span className="truncate font-medium">{name ?? "Account"}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setNotificationsOpen(true)}>
          <span className="relative flex size-4 items-center justify-center">
            <Bell className="size-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold leading-none text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>
          Notifications
        </DropdownMenuItem>
        <ModeToggle />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <NotificationBell
      unreadCount={unreadCount}
      open={notificationsOpen}
      onOpenChange={setNotificationsOpen}
    />
    </>
  );
}
