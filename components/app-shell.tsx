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
    <SidebarProvider defaultOpen={false}>
      <AppSidebar projects={projects} />
      <SidebarInset className="min-h-svh min-w-0 overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}
