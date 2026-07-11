"use client";

import * as React from "react";

// Personal, per-browser preference for which day the Timeline's week view
// starts on. Fallback matches the day the Timeline was hardcoded to before
// this setting existed, so nobody's view changes until they opt in.
const STORAGE_KEY = "week-starts-on";

export function useWeekStartsOn() {
  const [weekStartsOn, setWeekStartsOnState] = React.useState<0 | 1>(1);

  React.useEffect(() => {
    // Deliberate external-store sync: localStorage can only be read after
    // mount to avoid an SSR/client mismatch, so this is not derived state.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "0" || stored === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeekStartsOnState(Number(stored) as 0 | 1);
    }
  }, []);

  const setWeekStartsOn = React.useCallback((value: 0 | 1) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    setWeekStartsOnState(value);
  }, []);

  return { weekStartsOn, setWeekStartsOn };
}
