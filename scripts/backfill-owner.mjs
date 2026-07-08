// One-time migration: assign every pre-auth row (userId IS NULL) to the owner.
//
// Existing Projects/Sections/Tags created before authentication have a NULL
// userId and are therefore invisible to everyone. After the owner has signed in
// once with Google (which creates their `user` row), run this to hand them all
// the legacy data. Tasks/Columns/StoryTasks have no userId — they follow their
// project automatically. Nothing is deleted; re-running is safe.
//
//   node --env-file=.env scripts/backfill-owner.mjs
//
// Override the target email with OWNER_EMAIL=someone@example.com if needed.
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const OWNER_EMAIL = process.env.OWNER_EMAIL || "rajalehe7102@gmail.com";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(`SELECT id, email FROM "user" WHERE lower(email) = lower($1) LIMIT 1;`, [
  OWNER_EMAIL,
]);

if (rows.length === 0) {
  console.error(
    `No user found with email ${OWNER_EMAIL}. Sign in with Google as that account first, then re-run.`,
  );
  await pool.end();
  process.exit(1);
}

const ownerId = rows[0].id;
console.log(`Assigning orphaned rows to ${OWNER_EMAIL} (${ownerId})...`);

for (const table of ["Project", "Section", "Tag"]) {
  const res = await pool.query(
    `UPDATE "${table}" SET "userId" = $1 WHERE "userId" IS NULL;`,
    [ownerId],
  );
  console.log(`  ${table}: ${res.rowCount} row(s) reassigned`);
}

await pool.end();
console.log("Done.");
