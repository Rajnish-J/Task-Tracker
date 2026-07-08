// One-time, data-preserving schema migration for the auth feature.
// Creates better-auth tables, adds nullable userId ownership columns, swaps the
// global unique constraints for per-user composite ones, and adds indexes.
// Idempotent: safe to re-run. Run with:  node --env-file=.env scripts/apply-auth-schema.mjs
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Each entry is [label, sql]. Statements are individually try/caught so
// "already exists" on a re-run is logged and skipped rather than aborting.
const statements = [
  [
    "create user",
    `CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "emailVerified" boolean NOT NULL DEFAULT false,
      "image" text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "user_email_unique" UNIQUE("email")
    );`,
  ],
  [
    "create session",
    `CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "token" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL,
      CONSTRAINT "session_token_unique" UNIQUE("token"),
      CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "create account",
    `CREATE TABLE IF NOT EXISTS "account" (
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
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
    );`,
  ],
  [
    "create verification",
    `CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );`,
  ],
  ["add Tag.userId", `ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "userId" text;`],
  ["add Section.userId", `ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "userId" text;`],
  ["add Project.userId", `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "userId" text;`],
  [
    "fk Tag.userId",
    `ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade;`,
  ],
  [
    "fk Section.userId",
    `ALTER TABLE "Section" ADD CONSTRAINT "Section_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade;`,
  ],
  [
    "fk Project.userId",
    `ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade;`,
  ],
  ["drop old Tag unique", `ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_name_unique";`],
  ["drop old Section unique", `ALTER TABLE "Section" DROP CONSTRAINT IF EXISTS "Section_slug_unique";`],
  ["drop old Project unique", `ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_slug_unique";`],
  [
    "add Tag composite unique",
    `ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_name_key" UNIQUE("userId","name");`,
  ],
  [
    "add Section composite unique",
    `ALTER TABLE "Section" ADD CONSTRAINT "Section_userId_slug_key" UNIQUE("userId","slug");`,
  ],
  [
    "add Project composite unique",
    `ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_slug_key" UNIQUE("userId","slug");`,
  ],
  ["index Tag.userId", `CREATE INDEX IF NOT EXISTS "Tag_userId_idx" ON "Tag"("userId");`],
  ["index Section.userId", `CREATE INDEX IF NOT EXISTS "Section_userId_idx" ON "Section"("userId");`],
  ["index Project.userId", `CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");`],
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
