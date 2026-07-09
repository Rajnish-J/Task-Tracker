import { ChatPage } from "@/components/chat/chat-page";
import { getCurrentUserId } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Auth guard — redirects to /login when signed out, like sibling pages.
  await getCurrentUserId();
  return <ChatPage />;
}
