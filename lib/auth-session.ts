import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Server-side guard used by every read function and server action. Resolves the
// signed-in user's id, or redirects to /login when there is no session. Because
// each data/mutation function derives the user itself, page/component call sites
// stay unchanged and data stays scoped to the owner.
export async function getCurrentUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return session.user.id;
}
