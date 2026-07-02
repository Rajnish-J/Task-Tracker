"use client";

import * as React from "react";
import { useServerInsertedHTML } from "next/navigation";

// Lightweight theme provider replacing next-themes, which renders its no-flash
// <script> inside the React tree. On React 19 / Next 16 that script is hoisted
// on the client (triggering "Encountered a script tag while rendering React
// component") and offsets the SSR DOM, cascading into sidebar hydration
// mismatches. Here the script is injected into <head> via useServerInsertedHTML
// (server-only), so it never enters the client React tree.

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "theme";

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

// Runs before paint: applies the persisted (or system) theme to <html> so there
// is no flash. Kept as a compact IIFE string; failures are swallowed so a
// blocked localStorage never breaks the page.
const themeScript = `(function(){try{var d=document.documentElement;var e=localStorage.getItem('${STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=e==='dark'||((!e||e==='system')&&m);d.classList.toggle('dark',dark);}catch(_){}})();`;

export function ThemeProvider({
  children,
  defaultTheme = "system",
  // Accepted for a drop-in, next-themes-compatible call site. `attribute` and
  // `enableSystem` are implied by this implementation (class-based, system-aware).
  disableTransitionOnChange = false,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  // useServerInsertedHTML fires once per streaming flush; guard so the script is
  // emitted a single time (into <head>) rather than on every Suspense boundary.
  const injected = React.useRef(false);
  useServerInsertedHTML(() => {
    if (injected.current) return null;
    injected.current = true;
    return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
  });

  // Start from defaultTheme on server and client so hydration matches; the inline
  // script has already applied the correct class to <html> before paint.
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  // Read the persisted choice after mount.
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      // Deliberate external-store sync: localStorage can only be read after
      // mount to avoid an SSR/client mismatch, so this is not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(stored);
    }
  }, []);

  // Apply the theme to <html> and track the resolved value, following the OS
  // preference while theme is "system".
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved: ResolvedTheme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      if (disableTransitionOnChange) {
        // Suppress CSS transitions during the class swap, then restore them.
        const style = document.createElement("style");
        style.appendChild(
          document.createTextNode("*,*::before,*::after{transition:none !important}"),
        );
        document.head.appendChild(style);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => style.remove());
        });
      }
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage failures (private mode, etc.).
      }
      setThemeState(next);
    },
    [disableTransitionOnChange],
  );

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
