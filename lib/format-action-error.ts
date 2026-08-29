/** User-facing message for client-side server action failures. */
export function formatActionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/Failed to find Server Action|server action/i.test(message)) {
    return "This page is out of date after a recent update. Reload the page (hard refresh), then submit again.";
  }
  if (/Body exceeded|body size limit|413/i.test(message)) {
    return "Upload is too large. Use a smaller file (under 5 MB), then try again.";
  }
  return message || "Something went wrong. Reload the page and try again.";
}
