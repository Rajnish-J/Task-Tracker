// Shared styling for native <select> elements used across create/edit forms.
//
// Native selects must set explicit background + text colors. With `bg-transparent`
// the closed control inherits the surface, but the OPEN option list falls back to
// the browser default (a light popup), so in dark mode `text-foreground` (light)
// renders light-on-white and becomes unreadable. Pinning both the control and its
// <option>s to theme tokens keeps them legible in light and dark mode.

// Base control styling. Compose with `cn()` to override width/height/padding per use.
export const nativeSelectClass =
  "h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-input/30 dark:hover:bg-input/50";

// Applied to each <option> so the dropdown list matches the popover surface.
export const nativeSelectOptionClass = "bg-popover text-popover-foreground";
