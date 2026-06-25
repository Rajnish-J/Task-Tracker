import { AppShell } from "@/components/app-shell";
import { getProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const projects = await getProjects();

  return <AppShell projects={projects}>{children}</AppShell>;
}
