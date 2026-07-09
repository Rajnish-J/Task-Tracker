import { redirect } from "next/navigation";

import { EmptyWorkspace } from "@/components/empty-workspace";
import { getProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await getProjects();

  if (projects[0]) {
    redirect(`/projects/${projects[0].id}`);
  }

  return <EmptyWorkspace />;
}
