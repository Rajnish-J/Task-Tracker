ALTER TABLE "TeamMemberPermission" DROP CONSTRAINT "TeamMemberPermission_teamId_userId_resource_action_key";--> statement-breakpoint
ALTER TABLE "TeamMemberPermission" ADD COLUMN "projectId" text DEFAULT '*' NOT NULL;--> statement-breakpoint
CREATE INDEX "TeamMemberPermission_projectId_idx" ON "TeamMemberPermission" USING btree ("projectId");--> statement-breakpoint
ALTER TABLE "TeamMemberPermission" ADD CONSTRAINT "TeamMemberPermission_teamId_userId_resource_action_projectId_key" UNIQUE("teamId","userId","resource","action","projectId");