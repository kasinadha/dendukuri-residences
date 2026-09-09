import { friendlyDatabaseError } from "@/lib/money";

export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function rethrowIfRedirect(error: unknown): void {
  if (isNextRedirectError(error)) throw error;
}

/** User-facing message for server action failures. */
export function formatActionError(
  err: unknown,
  fallback = "Something went wrong. Reload the page and try again."
): string {
  rethrowIfRedirect(err);
  const message = err instanceof Error ? err.message : String(err);
  if (/Failed to find Server Action|server action/i.test(message)) {
    return "This page is out of date after a recent update. Reload the page (hard refresh), then submit again.";
  }
  if (/Body exceeded|body size limit|413/i.test(message)) {
    return "Upload is too large. Use a smaller file (under 5 MB), then try again.";
  }
  return friendlyDatabaseError(message || fallback);
}
