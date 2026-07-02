"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tag as TagIcon } from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

type TagOption = { id: string; name: string; color: string };

const ALL = "";

// Client shell for the dashboard. It owns the tag filter and wraps the
// navigation in a transition so `isPending` flips the moment the user picks a
// tag — the skeletons render instantly while the server re-renders the page,
// rather than waiting ~2s for the server round-trip to start streaming.
export function DashboardShell({
  tags,
  selectedTagId,
  badges,
  children,
}: {
  tags: TagOption[];
  selectedTagId?: string;
  badges: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  function handleChange(value: string) {
    const params = new URLSearchParams();
    if (value) {
      params.set("tag", value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1 text-foreground" />
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground">Dashboard</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              {isPending ? <HeaderBadgesSkeleton /> : badges}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A live overview of every board — how many cards exist and how they
              break down by status, priority, and due date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TagIcon className="size-4 text-muted-foreground" />
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="dashboard-tag-filter"
            >
              Filter by tag
            </label>
            <Select
              value={selectedTagId ?? ALL}
              onValueChange={(next) => handleChange(next ?? ALL)}
              disabled={isPending}
              items={[
                { label: "All tags", value: ALL },
                ...tags.map((tag) => ({ label: tag.name, value: tag.id })),
              ]}
            >
              <SelectTrigger
                id="dashboard-tag-filter"
                aria-label="Filter by tag"
                className="h-9 min-w-48"
              >
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {isPending ? <DashboardSkeleton /> : children}
    </div>
  );
}

function HeaderBadgesSkeleton() {
  return (
    <>
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </>
  );
}
