// One-time, data-preserving schema migration for the teams feature.
// Creates Team/TeamMember/TeamInvitation/Notification tables, adds nullable
// teamId ownership columns to Project/Section/Tag with team-side composite
// uniques, and adds indexes. Existing per-user constraints are untouched
// (all existing rows have teamId NULL, and NULLs never collide).
// Idempotent: safe to re-run. `npm run db:push` reaches the same end state on
// a fresh database; this script is the data-preserving path.
// Run with:  node --env-file=.env scripts/apply-teams-schema.mjs
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Each entry is [label, sql]. Statements are individually try/caught so
// "already exists" on a re-run is logged and skipped rather than aborting.
const statements = [
  [
    "create Team",
    `CREATE TABLE IF NOT EXISTS "Team" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "color" text,
      "creatorId" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "Team_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "create TeamMember",
    `CREATE TABLE IF NOT EXISTS "TeamMember" (
      "id" text PRIMARY KEY NOT NULL,
      "teamId" text NOT NULL,
      "userId" text NOT NULL,
      "role" text NOT NULL DEFAULT 'member',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "TeamMember_teamId_userId_key" UNIQUE("teamId","userId"),
      CONSTRAINT "TeamMember_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE cascade,
      CONSTRAINT "TeamMember_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "create TeamInvitation",
    `CREATE TABLE IF NOT EXISTS "TeamInvitation" (
      "id" text PRIMARY KEY NOT NULL,
      "teamId" text NOT NULL,
      "inviterId" text NOT NULL,
      "inviteeId" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "respondedAt" timestamp,
      CONSTRAINT "TeamInvitation_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE cascade,
      CONSTRAINT "TeamInvitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE cascade,
      CONSTRAINT "TeamInvitation_inviteeId_user_id_fk" FOREIGN KEY ("inviteeId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "create Notification",
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL,
      "type" text NOT NULL,
      "payload" jsonb NOT NULL,
      "readAt" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "Notification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "unique pending invite per (team, invitee)",
    `CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvitation_teamId_inviteeId_pending_key"
      ON "TeamInvitation"("teamId","inviteeId") WHERE "status" = 'pending';`,
  ],
  ["index Team.creatorId", `CREATE INDEX IF NOT EXISTS "Team_creatorId_idx" ON "Team"("creatorId");`],
  ["index TeamMember.teamId", `CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember"("teamId");`],
  ["index TeamMember.userId", `CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");`],
  ["index TeamInvitation.teamId", `CREATE INDEX IF NOT EXISTS "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");`],
  ["index TeamInvitation.inviteeId", `CREATE INDEX IF NOT EXISTS "TeamInvitation_inviteeId_idx" ON "TeamInvitation"("inviteeId");`],
  [
    "index Notification (userId, createdAt)",
    `CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId","createdAt");`,
  ],
  ["add Tag.teamId", `ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "teamId" text;`],
  ["add Section.teamId", `ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "teamId" text;`],
  ["add Project.teamId", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "teamId" text;`],
  [
    "fk Tag.teamId",
    `ALTER TABLE "Tag" ADD CONSTRAINT "Tag_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE cascade;`,
  ],
  [
    "fk Section.teamId",
    `ALTER TABLE "Section" ADD CONSTRAINT "Section_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE cascade;`,
  ],
  [
    "fk Project.teamId",
    `ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE cascade;`,
  ],
  [
    "add Tag team composite unique",
    `ALTER TABLE "Tag" ADD CONSTRAINT "Tag_teamId_name_key" UNIQUE("teamId","name");`,
  ],
  [
    "add Section team composite unique",
    `ALTER TABLE "Section" ADD CONSTRAINT "Section_teamId_slug_key" UNIQUE("teamId","slug");`,
  ],
  [
    "add Project team composite unique",
    `ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_slug_key" UNIQUE("teamId","slug");`,
  ],
  ["index Tag.teamId", `CREATE INDEX IF NOT EXISTS "Tag_teamId_idx" ON "Tag"("teamId");`],
  ["index Section.teamId", `CREATE INDEX IF NOT EXISTS "Section_teamId_idx" ON "Section"("teamId");`],
  ["index Project.teamId", `CREATE INDEX IF NOT EXISTS "Project_teamId_idx" ON "Project"("teamId");`],
];

for (const [label, sql] of statements) {
  try {
    await pool.query(sql);
    console.log(`OK   ${label}`);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/already exists|duplicate/i.test(msg)) {
      console.log(`SKIP ${label} (already applied)`);
    } else {
      console.error(`FAIL ${label}: ${msg}`);
      throw err;
    }
  }
}

await pool.end();
console.log("Done.");
