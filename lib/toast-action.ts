import { toast } from "sonner";

// Server actions that call redirect() throw a NEXT_REDIRECT digest error —
// that must propagate to Next's router untouched, never toasted as a failure.
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// Wraps a server-action call (outside a <form>, e.g. useTransition or a plain
// async handler) with success/error toasts, re-throwing redirects so callers
// that rely on the navigation (or their own catch) still see it.
export async function runWithToast<T>(
  fn: () => Promise<T>,
  { success, error }: { success?: string; error?: string } = {},
): Promise<T | undefined> {
  try {
    const result = await fn();
    if (success) toast.success(success);
    return result;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    toast.error(error ?? "Something went wrong. Please try again.");
    return undefined;
  }
}
