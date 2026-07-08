import { createAuthClient } from "better-auth/react";

// Base URL is inferred from the current origin in the browser.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
