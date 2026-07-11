"use client";

import * as React from "react";

// Personal, per-browser defaults applied when creating a new task/story task
// (priority + tag). Mirrors theme-provider's SSR-safe localStorage pattern:
// start from a fixed fallback so server and first client render match, then
// sync from localStorage in an effect.
const PRIORITY_KEY = "task-defaults.priority";
const TAG_KEY = "task-defaults.tagId";

export function useTaskDefaults() {
  const [defaultPriority, setDefaultPriorityState] = React.useState("MEDIUM");
  const [defaultTagId, setDefaultTagIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Deliberate external-store sync: localStorage can only be read after
    // mount to avoid an SSR/client mismatch, so this is not derived state.
    const priority = localStorage.getItem(PRIORITY_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (priority) setDefaultPriorityState(priority);
    const tagId = localStorage.getItem(TAG_KEY);
    if (tagId) setDefaultTagIdState(tagId);
  }, []);

  const setDefaultPriority = React.useCallback((priority: string) => {
    localStorage.setItem(PRIORITY_KEY, priority);
    setDefaultPriorityState(priority);
  }, []);

  const setDefaultTagId = React.useCallback((tagId: string | null) => {
    if (tagId) {
      localStorage.setItem(TAG_KEY, tagId);
    } else {
      localStorage.removeItem(TAG_KEY);
    }
    setDefaultTagIdState(tagId);
  }, []);

  return { defaultPriority, defaultTagId, setDefaultPriority, setDefaultTagId };
}
