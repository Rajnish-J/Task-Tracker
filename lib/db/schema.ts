import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
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

export const projects = pgTable("Project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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
  },
  (table) => [
    unique("Task_columnId_position_key").on(table.columnId, table.position),
    index("Task_projectId_idx").on(table.projectId),
    index("Task_columnId_idx").on(table.columnId),
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
  },
  (table) => [
    unique("StoryTask_taskId_position_key").on(table.taskId, table.position),
    index("StoryTask_taskId_idx").on(table.taskId),
  ],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  columns: many(columns),
  tasks: many(tasks),
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
}));

export const storyTasksRelations = relations(storyTasks, ({ one }) => ({
  task: one(tasks, {
    fields: [storyTasks.taskId],
    references: [tasks.id],
  }),
}));
