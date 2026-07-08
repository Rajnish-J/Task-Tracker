import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Email/password + Google authentication. better-auth reads the session
// cookie/JWT and maps users to the Drizzle
// `user`/`session`/`account`/`verification` tables.
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Sign the user in immediately after a successful sign-up so the client
    // redirect to `callbackURL` lands on an authenticated session.
    autoSignIn: true,
  },
  user: {
    // Allow the client `deleteUser()` flow used by the settings Danger zone.
    // Deleting a user cascades through session/account and our
    // Project/Section/Tag.userId FKs (and onward to columns/tasks/storyTasks).
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
