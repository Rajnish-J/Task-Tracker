import { AppShell } from "@/components/app-shell";
import { flattenSectionTree, getSectionsTree } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("[diag] WorkspaceLayout render");
  const { tree, ungroupedProjects } = await getSectionsTree();
  const sectionOptions = flattenSectionTree(tree);

  return (
    <AppShell tree={tree} ungroupedProjects={ungroupedProjects} sectionOptions={sectionOptions}>
      {children}
    </AppShell>
  );
}
