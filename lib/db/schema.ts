import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const priorityEnum = pgEnum("Priority", PRIORITY_VALUES);

// Shared, workspace-wide tags. Each project/task/storyTask references at most one
// tag (a category). Names are unique so the same tag can be reused everywhere.
export const tags = pgTable("Tag", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// A Section groups related projects and can nest under another section (a
// nullable self-referential parent). Deleting a section promotes its children
// to the top level and ungroups its projects rather than cascading.
export const sections = pgTable(
  "Section",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    parentId: text("parentId"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Section_parentId_idx").on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "Section_parentId_fkey",
    }).onDelete("set null"),
  ],
);

export const projects = pgTable(
  "Project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    tagId: text("tagId").references(() => tags.id, { onDelete: "set null" }),
    sectionId: text("sectionId").references(() => sections.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Project_tagId_idx").on(table.tagId),
    index("Project_sectionId_idx").on(table.sectionId),
  ],
);

export const columns = pgTable(
  "Column",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    color: text("color"),
    position: integer("position").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("Column_projectId_position_key").on(table.projectId, table.position),
    index("Column_projectId_idx").on(table.projectId),
  ],
);

export const tasks = pgTable(
  "Task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    shortDescription: text("shortDescription"),
    description: text("description"),
    notes: text("notes"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    dueDate: timestamp("dueDate", { mode: "date" }),
    position: integer("position").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    columnId: text("columnId")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    tagId: text("tagId").references(() => tags.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("Task_columnId_position_key").on(table.columnId, table.position),
    index("Task_projectId_idx").on(table.projectId),
    index("Task_columnId_idx").on(table.columnId),
    index("Task_tagId_idx").on(table.tagId),
  ],
);

export const storyTasks = pgTable(
  "StoryTask",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    dueDate: timestamp("dueDate", { mode: "date" }),
    isDone: boolean("isDone").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tagId").references(() => tags.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("StoryTask_taskId_position_key").on(table.taskId, table.position),
    index("StoryTask_taskId_idx").on(table.taskId),
    index("StoryTask_tagId_idx").on(table.tagId),
  ],
);

export const tagsRelations = relations(tags, ({ many }) => ({
  projects: many(projects),
  tasks: many(tasks),
  storyTasks: many(storyTasks),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  parent: one(sections, {
    fields: [sections.parentId],
    references: [sections.id],
    relationName: "sectionHierarchy",
  }),
  children: many(sections, { relationName: "sectionHierarchy" }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  columns: many(columns),
  tasks: many(tasks),
  tag: one(tags, {
    fields: [projects.tagId],
    references: [tags.id],
  }),
  section: one(sections, {
    fields: [projects.sectionId],
    references: [sections.id],
  }),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  project: one(projects, {
    fields: [columns.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  column: one(columns, {
    fields: [tasks.columnId],
    references: [columns.id],
  }),
  storyTasks: many(storyTasks),
  tag: one(tags, {
    fields: [tasks.tagId],
    references: [tags.id],
  }),
}));

export const storyTasksRelations = relations(storyTasks, ({ one }) => ({
  task: one(tasks, {
    fields: [storyTasks.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [storyTasks.tagId],
    references: [tags.id],
  }),
}));
