"use client";

import * as React from "react";

// The active space, provided by the workspace layouts (personal or team).
// Client components use `useSpace()` to prefix links with the space's base
// path and to gate owner-only affordances; forms drop in `<SpaceField />` so
// server actions can resolve the same space server-side.
export type Space = {
  teamId: string | null;
  role: "owner" | "member" | null;
  basePath: string;
};

const SpaceContext = React.createContext<Space>({
  teamId: null,
  role: null,
  basePath: "",
});

export function SpaceProvider({
  teamId,
  role,
  children,
}: {
  teamId: string | null;
  role: "owner" | "member" | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo<Space>(
    () => ({ teamId, role, basePath: teamId ? `/teams/${teamId}` : "" }),
    [teamId, role],
  );
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace(): Space {
  return React.useContext(SpaceContext);
}

// True when the current user may manage structure (projects/sections) in the
// active space: always in personal space, owner-only in a team.
export function useCanManageStructure(): boolean {
  const { teamId, role } = useSpace();
  return !teamId || role === "owner";
}

// Hidden input that carries the active team into FormData-based server
// actions. Renders nothing in personal space.
export function SpaceField() {
  const { teamId } = useSpace();
  if (!teamId) return null;
  return <input type="hidden" name="teamId" value={teamId} />;
}
