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

// ---------------------------------------------------------------------------
// Authentication tables (better-auth). Names/columns match better-auth's
// default Drizzle schema so the drizzleAdapter can map to them directly.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// Shared, workspace-wide tags. Each project/task/storyTask references at most one
// tag (a category). Names are unique so the same tag can be reused everywhere.
export const tags = pgTable(
  "Tag",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    color: text("color").notNull(),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Tag_userId_name_key").on(table.userId, table.name),
    index("Tag_userId_idx").on(table.userId),
  ],
);

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
    slug: text("slug").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    parentId: text("parentId"),
    tagId: text("tagId").references(() => tags.id, { onDelete: "set null" }),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Section_userId_slug_key").on(table.userId, table.slug),
    index("Section_parentId_idx").on(table.parentId),
    index("Section_tagId_idx").on(table.tagId),
    index("Section_userId_idx").on(table.userId),
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
    slug: text("slug").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    tagId: text("tagId").references(() => tags.id, { onDelete: "set null" }),
    sectionId: text("sectionId").references(() => sections.id, {
      onDelete: "set null",
    }),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Project_userId_slug_key").on(table.userId, table.slug),
    index("Project_tagId_idx").on(table.tagId),
    index("Project_sectionId_idx").on(table.sectionId),
    index("Project_userId_idx").on(table.userId),
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
  sections: many(sections),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  parent: one(sections, {
    fields: [sections.parentId],
    references: [sections.id],
    relationName: "sectionHierarchy",
  }),
  children: many(sections, { relationName: "sectionHierarchy" }),
  projects: many(projects),
  tag: one(tags, {
    fields: [sections.tagId],
    references: [tags.id],
  }),
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
