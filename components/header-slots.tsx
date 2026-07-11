"use client";

import * as React from "react";

type HeaderSlotsValue = {
  breadcrumb: React.ReactNode;
  setBreadcrumb: (node: React.ReactNode) => void;
  trailing: React.ReactNode;
  setTrailing: (node: React.ReactNode) => void;
};

const HeaderSlotsContext = React.createContext<HeaderSlotsValue | null>(null);

// Lets page content (client or server components) publish content into the
// global SiteHeader — the breadcrumb next to the sidebar toggle, and extra
// actions rendered after the notification bell — without SiteHeader needing
// to know about any specific page.
export function HeaderSlotsProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumb, setBreadcrumb] = React.useState<React.ReactNode>(null);
  const [trailing, setTrailing] = React.useState<React.ReactNode>(null);
  const value = React.useMemo(
    () => ({ breadcrumb, setBreadcrumb, trailing, setTrailing }),
    [breadcrumb, trailing],
  );
  return <HeaderSlotsContext.Provider value={value}>{children}</HeaderSlotsContext.Provider>;
}

export function useHeaderSlots() {
  const ctx = React.useContext(HeaderSlotsContext);
  if (!ctx) throw new Error("useHeaderSlots must be used within a HeaderSlotsProvider");
  return ctx;
}

// Mount inside any page (server or client) to publish its breadcrumb into the
// site header for as long as the page stays mounted.
export function HeaderBreadcrumb({ children }: { children: React.ReactNode }) {
  const { setBreadcrumb } = useHeaderSlots();
  React.useEffect(() => {
    setBreadcrumb(children);
    return () => setBreadcrumb(null);
  }, [children, setBreadcrumb]);
  return null;
}

// Mount inside any page to publish extra actions rendered after the
// notification bell (e.g. the chat page's conversation history toggle).
export function HeaderTrailing({ children }: { children: React.ReactNode }) {
  const { setTrailing } = useHeaderSlots();
  React.useEffect(() => {
    setTrailing(children);
    return () => setTrailing(null);
  }, [children, setTrailing]);
  return null;
}
