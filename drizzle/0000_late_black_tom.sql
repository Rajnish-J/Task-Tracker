CREATE TYPE "public"."Priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChatMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"idx" integer NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"text" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ChatMessage_conversationId_idx_key" UNIQUE("conversationId","idx")
);
--> statement-breakpoint
CREATE TABLE "Column" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"projectId" text NOT NULL,
	CONSTRAINT "Column_projectId_position_key" UNIQUE("projectId","position")
);
--> statement-breakpoint
CREATE TABLE "Conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"tagId" text,
	"sectionId" text,
	"userId" text,
	"teamId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Project_userId_slug_key" UNIQUE("userId","slug"),
	CONSTRAINT "Project_teamId_slug_key" UNIQUE("teamId","slug")
);
--> statement-breakpoint
CREATE TABLE "Section" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"parentId" text,
	"tagId" text,
	"userId" text,
	"teamId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Section_userId_slug_key" UNIQUE("userId","slug"),
	CONSTRAINT "Section_teamId_slug_key" UNIQUE("teamId","slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "StoryTask" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "Priority" DEFAULT 'MEDIUM' NOT NULL,
	"dueDate" timestamp,
	"isDone" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"taskId" text NOT NULL,
	"tagId" text,
	CONSTRAINT "StoryTask_taskId_position_key" UNIQUE("taskId","position")
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"userId" text,
	"teamId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Tag_userId_name_key" UNIQUE("userId","name"),
	CONSTRAINT "Tag_teamId_name_key" UNIQUE("teamId","name")
);
--> statement-breakpoint
CREATE TABLE "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"shortDescription" text,
	"description" text,
	"notes" text,
	"priority" "Priority" DEFAULT 'MEDIUM' NOT NULL,
	"dueDate" timestamp,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"projectId" text NOT NULL,
	"columnId" text NOT NULL,
	"tagId" text,
	CONSTRAINT "Task_columnId_position_key" UNIQUE("columnId","position")
);
--> statement-breakpoint
CREATE TABLE "TeamInvitation" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"inviterId" text NOT NULL,
	"inviteeId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"respondedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "TeamMemberPermission" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "TeamMemberPermission_teamId_userId_resource_action_key" UNIQUE("teamId","userId","resource","action")
);
--> statement-breakpoint
CREATE TABLE "TeamMember" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "TeamMember_teamId_userId_key" UNIQUE("teamId","userId")
);
--> statement-breakpoint
CREATE TABLE "Team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"creatorId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_Conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Column" ADD CONSTRAINT "Column_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_sectionId_Section_id_fk" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "Section_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "Section_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "Section_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "Section_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StoryTask" ADD CONSTRAINT "StoryTask_taskId_Task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StoryTask" ADD CONSTRAINT "StoryTask_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_Column_id_fk" FOREIGN KEY ("columnId") REFERENCES "public"."Column"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviteeId_user_id_fk" FOREIGN KEY ("inviteeId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMemberPermission" ADD CONSTRAINT "TeamMemberPermission_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMemberPermission" ADD CONSTRAINT "TeamMemberPermission_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Team" ADD CONSTRAINT "Team_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX "Column_projectId_idx" ON "Column" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "Conversation_userId_idx" ON "Conversation" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "Project_tagId_idx" ON "Project" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "Project_sectionId_idx" ON "Project" USING btree ("sectionId");--> statement-breakpoint
CREATE INDEX "Project_userId_idx" ON "Project" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Project_teamId_idx" ON "Project" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "Section_parentId_idx" ON "Section" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "Section_tagId_idx" ON "Section" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "Section_userId_idx" ON "Section" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Section_teamId_idx" ON "Section" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "StoryTask_taskId_idx" ON "StoryTask" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "StoryTask_tagId_idx" ON "StoryTask" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "Tag_userId_idx" ON "Tag" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Tag_teamId_idx" ON "Tag" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "Task_projectId_idx" ON "Task" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "Task_columnId_idx" ON "Task" USING btree ("columnId");--> statement-breakpoint
CREATE INDEX "Task_tagId_idx" ON "Task" USING btree ("tagId");--> statement-breakpoint
CREATE UNIQUE INDEX "TeamInvitation_teamId_inviteeId_pending_key" ON "TeamInvitation" USING btree ("teamId","inviteeId") WHERE "TeamInvitation"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "TeamInvitation_teamId_idx" ON "TeamInvitation" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamInvitation_inviteeId_idx" ON "TeamInvitation" USING btree ("inviteeId");--> statement-breakpoint
CREATE INDEX "TeamMemberPermission_teamId_idx" ON "TeamMemberPermission" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamMemberPermission_teamId_userId_idx" ON "TeamMemberPermission" USING btree ("teamId","userId");--> statement-breakpoint
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Team_creatorId_idx" ON "Team" USING btree ("creatorId");