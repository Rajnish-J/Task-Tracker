// Client-safe tool metadata (no server imports) — shared by the chat UI
// (Tools popover, activity chips) and the server (activity labels, mutation
// detection). The actual tool schemas + executor live in lib/ai/tools.ts,
// which imports the database and must stay server-only.

export type ToolMeta = { name: string; label: string; activity: string };

export const TOOL_CATALOG: { category: string; tools: ToolMeta[] }[] = [
  {
    category: "Read",
    tools: [
      { name: "list_sections", label: "List sections", activity: "Reading sections…" },
      { name: "list_projects", label: "List projects", activity: "Reading projects…" },
      { name: "get_project_board", label: "Read board", activity: "Reading board…" },
      { name: "get_task", label: "Read task", activity: "Reading task…" },
    ],
  },
  {
    category: "Sections",
    tools: [
      { name: "create_section", label: "Create section", activity: "Creating section…" },
      { name: "update_section", label: "Update section", activity: "Updating section…" },
      { name: "delete_section", label: "Delete section", activity: "Deleting section…" },
    ],
  },
  {
    category: "Projects",
    tools: [
      { name: "create_project", label: "Create project", activity: "Creating project…" },
      { name: "update_project", label: "Update project", activity: "Updating project…" },
      { name: "delete_project", label: "Delete project", activity: "Deleting project…" },
    ],
  },
  {
    category: "Columns & status",
    tools: [
      { name: "create_column", label: "Create column", activity: "Creating column…" },
      { name: "update_column", label: "Update column", activity: "Updating column…" },
      { name: "delete_column", label: "Delete column", activity: "Deleting column…" },
      { name: "move_task", label: "Move task / change status", activity: "Moving task…" },
    ],
  },
  {
    category: "Tasks",
    tools: [
      { name: "create_task", label: "Create task", activity: "Creating task…" },
      { name: "update_task", label: "Update task", activity: "Updating task…" },
      { name: "delete_task", label: "Delete task", activity: "Deleting task…" },
    ],
  },
  {
    category: "Checklist items",
    tools: [
      { name: "create_story_task", label: "Add checklist item", activity: "Adding checklist item…" },
      { name: "update_story_task", label: "Update checklist item", activity: "Updating checklist item…" },
      { name: "toggle_story_task", label: "Check/uncheck item", activity: "Toggling checklist item…" },
      { name: "delete_story_task", label: "Delete checklist item", activity: "Deleting checklist item…" },
    ],
  },
];

const ALL_TOOL_METAS = TOOL_CATALOG.flatMap((group) => group.tools);

export function activityLabelFor(toolName: string) {
  return ALL_TOOL_METAS.find((tool) => tool.name === toolName)?.activity ?? "Working…";
}

const READ_TOOL_NAMES = ["list_sections", "list_projects", "get_project_board", "get_task"];

export const MUTATION_TOOL_NAMES = new Set(
  ALL_TOOL_METAS.map((tool) => tool.name).filter((name) => !READ_TOOL_NAMES.includes(name)),
);
