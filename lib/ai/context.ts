import { asc } from "drizzle-orm";

import { db } from "@/lib/db";

// Compact snapshot of the user's workspace injected as the volatile second
// system block, so the model can resolve names → ids without a tool round-trip
// for common requests. Queries db directly with the given uid — never call the
// lib/data.ts readers here (they resolve the session and redirect() on miss,
// which is unsupported inside a route handler).
export async function buildWorkspaceContext(uid: string): Promise<string> {
  const [sectionRows, projectRows] = await Promise.all([
    db.query.sections.findMany({
      where: (sections, { eq }) => eq(sections.userId, uid),
      orderBy: (sections) => [asc(sections.position), asc(sections.name)],
      columns: { id: true, name: true, parentId: true },
    }),
    db.query.projects.findMany({
      where: (projects, { eq }) => eq(projects.userId, uid),
      orderBy: (projects) => [asc(projects.position), asc(projects.name)],
      columns: { id: true, name: true, sectionId: true },
      with: {
        columns: {
          orderBy: (columns) => [asc(columns.position)],
          columns: { id: true, name: true, position: true },
        },
      },
    }),
  ]);

  const sectionNameById = new Map(sectionRows.map((s) => [s.id, s.name]));

  const lines: string[] = [
    "WORKSPACE SNAPSHOT (ids are canonical — always use ids, never names, in tool calls)",
  ];

  lines.push("Sections:");
  if (sectionRows.length === 0) {
    lines.push("- (none)");
  }
  for (const section of sectionRows) {
    const parent = section.parentId
      ? sectionNameById.get(section.parentId) ?? section.parentId
      : "none";
    lines.push(`- ${section.id} "${section.name}" (parent: ${parent})`);
  }

  lines.push("Projects (boards):");
  if (projectRows.length === 0) {
    lines.push("- (none)");
  }
  for (const project of projectRows) {
    const sectionName = project.sectionId
      ? sectionNameById.get(project.sectionId) ?? project.sectionId
      : "none";
    lines.push(`- ${project.id} "${project.name}" (section: ${sectionName})`);
    const cols = project.columns
      .map((column) => `${column.id} "${column.name}" (${column.position})`)
      .join(", ");
    lines.push(`  columns: ${cols || "(none)"}`);
  }

  return lines.join("\n");
}
