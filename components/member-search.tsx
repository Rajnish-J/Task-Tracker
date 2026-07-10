"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { searchUsersByEmail, type UserSearchResult } from "@/app/team-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
}

// Name/email type-ahead for inviting members (no command/popover primitive in
// this app, so it's a controlled input with an absolutely-positioned results
// list styled like dropdown-menu content). Debounced server-action search
// matches anywhere in the name or email. Selected users render as removable
// chips; `excludeIds` drops already-picked users from results, and
// `excludeTeamId` additionally filters out current members/pending invitees
// server-side.
export function MemberSearch({
  selected,
  onSelect,
  onRemove,
  excludeTeamId,
  placeholder = "Search by name or email…",
}: {
  selected: UserSearchResult[];
  onSelect: (user: UserSearchResult) => void;
  onRemove: (userId: string) => void;
  excludeTeamId?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<UserSearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  // Discard responses that arrive after a newer query was sent.
  const requestSeq = React.useRef(0);
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedIds = React.useMemo(() => new Set(selected.map((user) => user.id)), [selected]);
  const visibleResults = results.filter((user) => !selectedIds.has(user.id));

  // Debounced search kicked off from the change handler (not an effect).
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const term = value.trim();
    const seq = ++requestSeq.current;
    if (!term) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      searchUsersByEmail(term, excludeTeamId)
        .then((rows) => {
          if (requestSeq.current !== seq) return;
          setResults(rows);
          setOpen(true);
          setHighlighted(0);
        })
        .catch(() => {
          if (requestSeq.current === seq) setResults([]);
        });
    }, 300);
  };

  React.useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  // Close the list when clicking anywhere outside the component.
  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const pick = (user: UserSearchResult) => {
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open || visibleResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, visibleResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(visibleResults[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-48 truncate">{user.email}</span>
              <button
                type="button"
                aria-label={`Remove ${user.email}`}
                onClick={() => onRemove(user.id)}
                className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div ref={containerRef} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search users by name or email"
          autoComplete="off"
          className="pl-8"
        />
        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
            {visibleResults.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                No users found for “{query.trim()}”.
              </p>
            ) : (
              <ul>
                {visibleResults.map((user, index) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => pick(user)}
                      onMouseEnter={() => setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        index === highlighted && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Avatar className="size-7">
                        {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                        <AvatarFallback className="text-xs">
                          {initials(user.name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{user.name || user.email}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
