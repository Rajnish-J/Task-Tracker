import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
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

// ---------------------------------------------------------------------------
// Teams. A Team is a shared workspace: projects/sections/tags may belong to a
// team instead of a user. Rows are either personal (userId set, teamId NULL)
// or team-owned (teamId set, userId NULL) — the NULL userId on team rows keeps
// a member's account deletion from cascading into shared team data.
// ---------------------------------------------------------------------------

export const TEAM_ROLES = ["owner", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "declined", "canceled"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "team_invite",
  "invite_accepted",
  "invite_declined",
  "member_removed",
  "team_deleted",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Payloads denormalize team/actor names so notifications stay readable after
// the team (or the actor's membership) is gone.
export type NotificationPayload = {
  teamId?: string;
  teamName?: string;
  invitationId?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
};

export const teams = pgTable(
  "Team",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    icon: text("icon"),
    creatorId: text("creatorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("Team_creatorId_idx").on(table.creatorId)],
);

export const teamMembers = pgTable(
  "TeamMember",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // TeamRole
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("TeamMember_teamId_userId_key").on(table.teamId, table.userId),
    index("TeamMember_teamId_idx").on(table.teamId),
    index("TeamMember_userId_idx").on(table.userId),
  ],
);

export const teamInvitations = pgTable(
  "TeamInvitation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    inviterId: text("inviterId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    inviteeId: text("inviteeId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // InvitationStatus
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    respondedAt: timestamp("respondedAt", { mode: "date" }),
  },
  (table) => [
    // Only one live invite per (team, invitee); resolved invites don't block re-inviting.
    uniqueIndex("TeamInvitation_teamId_inviteeId_pending_key")
      .on(table.teamId, table.inviteeId)
      .where(sql`${table.status} = 'pending'`),
    index("TeamInvitation_teamId_idx").on(table.teamId),
    index("TeamInvitation_inviteeId_idx").on(table.inviteeId),
  ],
);

export const RESOURCE_VALUES = ["project", "section", "column", "task"] as const;
export type Resource = (typeof RESOURCE_VALUES)[number];

export const ACTION_VALUES = ["create", "update", "delete"] as const;
export type Action = (typeof ACTION_VALUES)[number];

// Sentinel projectId meaning "all projects" — i.e. today's team-wide grant.
// Not a real project id, so this column is plain text with no FK reference
// (matches how `resource`/`action` are already stored as unconstrained text).
export const ALL_PROJECTS_SCOPE = "*";

export const teamMemberPermissions = pgTable(
  "TeamMemberPermission",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(), // Resource
    action: text("action").notNull(), // Action
    projectId: text("projectId").notNull().default(ALL_PROJECTS_SCOPE),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("TeamMemberPermission_teamId_userId_resource_action_projectId_key").on(
      table.teamId,
      table.userId,
      table.resource,
      table.action,
      table.projectId,
    ),
    index("TeamMemberPermission_teamId_idx").on(table.teamId),
    index("TeamMemberPermission_teamId_userId_idx").on(table.teamId, table.userId),
    index("TeamMemberPermission_projectId_idx").on(table.projectId),
  ],
);

export const notifications = pgTable(
  "Notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // NotificationType
    payload: jsonb("payload").notNull().$type<NotificationPayload>(),
    readAt: timestamp("readAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("Notification_userId_createdAt_idx").on(table.userId, table.createdAt)],
);

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
    teamId: text("teamId").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Tag_userId_name_key").on(table.userId, table.name),
    unique("Tag_teamId_name_key").on(table.teamId, table.name),
    index("Tag_userId_idx").on(table.userId),
    index("Tag_teamId_idx").on(table.teamId),
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
    teamId: text("teamId").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Section_userId_slug_key").on(table.userId, table.slug),
    unique("Section_teamId_slug_key").on(table.teamId, table.slug),
    index("Section_parentId_idx").on(table.parentId),
    index("Section_tagId_idx").on(table.tagId),
    index("Section_userId_idx").on(table.userId),
    index("Section_teamId_idx").on(table.teamId),
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
    teamId: text("teamId").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("Project_userId_slug_key").on(table.userId, table.slug),
    unique("Project_teamId_slug_key").on(table.teamId, table.slug),
    index("Project_tagId_idx").on(table.tagId),
    index("Project_sectionId_idx").on(table.sectionId),
    index("Project_userId_idx").on(table.userId),
    index("Project_teamId_idx").on(table.teamId),
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

// ---------------------------------------------------------------------------
// AI chat assistant. A Conversation groups ChatMessages; each message row
// stores the verbatim Anthropic content-block array (jsonb) so history replays
// to the API without reconstruction, plus extracted plain text for rendering.
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  "Conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull().default("New chat"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("Conversation_userId_idx").on(table.userId)],
);

export const chatMessages = pgTable(
  "ChatMessage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    conversationId: text("conversationId")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Deterministic ordering within a conversation (0, 1, 2, …).
    idx: integer("idx").notNull(),
    role: text("role").notNull(), // "user" | "assistant"
    // Verbatim Anthropic content-block array (text / tool_use / tool_result).
    content: jsonb("content").notNull(),
    // Concatenated text blocks — render fallback and conversation previews.
    text: text("text"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("ChatMessage_conversationId_idx_key").on(table.conversationId, table.idx),
    index("ChatMessage_conversationId_idx").on(table.conversationId),
  ],
);

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [chatMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  projects: many(projects),
  tasks: many(tasks),
  storyTasks: many(storyTasks),
  sections: many(sections),
  team: one(teams, {
    fields: [tags.teamId],
    references: [teams.id],
  }),
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
  team: one(teams, {
    fields: [sections.teamId],
    references: [teams.id],
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
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
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

export const teamsRelations = relations(teams, ({ one, many }) => ({
  creator: one(user, {
    fields: [teams.creatorId],
    references: [user.id],
  }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
  projects: many(projects),
  sections: many(sections),
  tags: many(tags),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [teamMembers.userId],
    references: [user.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  inviter: one(user, {
    fields: [teamInvitations.inviterId],
    references: [user.id],
  }),
  invitee: one(user, {
    fields: [teamInvitations.inviteeId],
    references: [user.id],
  }),
}));

export const teamMemberPermissionsRelations = relations(teamMemberPermissions, ({ one }) => ({
  team: one(teams, {
    fields: [teamMemberPermissions.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [teamMemberPermissions.userId],
    references: [user.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
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
