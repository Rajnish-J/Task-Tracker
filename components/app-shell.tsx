import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type AppShellProps = {
  children: React.ReactNode;
  projects: {
    id: string;
    name: string;
    slug: string;
    columns: { id: string }[];
    _count: { tasks: number };
  }[];
};

export function AppShell({ children, projects }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar projects={projects} />
      <SidebarInset className="min-h-svh">{children}</SidebarInset>
    </SidebarProvider>
  );
}
