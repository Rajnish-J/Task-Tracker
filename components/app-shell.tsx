import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { SectionNode, SectionProject } from "@/lib/data";

type AppShellProps = {
  children: React.ReactNode;
  tree: SectionNode[];
  ungroupedProjects: SectionProject[];
  sectionOptions: { id: string; label: string }[];
};

export function AppShell({ children, tree, ungroupedProjects, sectionOptions }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        tree={tree}
        ungroupedProjects={ungroupedProjects}
        sectionOptions={sectionOptions}
      />
      <SidebarInset className="min-h-svh min-w-0 overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}
