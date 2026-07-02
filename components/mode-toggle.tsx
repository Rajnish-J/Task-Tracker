"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <SidebarMenuButton
      tooltip={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-full"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <MoonStar /> : <SunMedium />}
      <span>Theme</span>
    </SidebarMenuButton>
  );
}
