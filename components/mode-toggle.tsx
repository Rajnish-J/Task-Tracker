"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Deliberate mount flag to avoid a hydration mismatch between the SSR
    // default and the client-resolved theme (same pattern as theme-provider.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <MoonStar /> : <SunMedium />}
      Theme
    </DropdownMenuItem>
  );
}
