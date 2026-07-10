import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "@/lib/db/schema";

// The neon-serverless driver talks over WebSocket, which enables interactive
// transactions (db.transaction with awaits inside). In a Node runtime there is
// no global WebSocket, so wire up the `ws` polyfill.
neonConfig.webSocketConstructor = ws;

// Route non-transactional pool queries (every read + simple writes) over Neon's
// stateless HTTP fetch instead of the persistent WebSocket. The long-lived WS in
// a dev/serverless process gets torn down between requests, which surfaced as
// "Connection closed." errors on server-action writes. Transactions still use
// the WebSocket via pool.connect().
neonConfig.poolQueryViaFetch = true;

declare global {
  var __dbPool: Pool | undefined;
}

const pool =
  global.__dbPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  global.__dbPool = pool;
}

export const db = drizzle(pool, { schema });
