/** Civil calendar date/month in Asia/Kolkata (billing is IST). */

const IST = "Asia/Kolkata";

/**
 * YYYY-MM-DD for a stored date or timestamptz.
 * Midnight 1 Sep IST stored as 31 Aug 18:30 UTC must still be September.
 */
export function calendarDateIsoFromValue(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dateOnly) return dateOnly[1];

  const hasClockOrTz = /T/.test(trimmed) || /[zZ]|[+-]\d{2}:\d{2}/.test(trimmed);
  const leading = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (leading && !hasClockOrTz) return leading[1];

  const ms = Date.parse(trimmed);
  if (Number.isFinite(ms)) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  }

  return leading?.[1] ?? null;
}

/** YYYY-MM from a stored date or timestamptz (IST calendar month). */
export function calendarMonthKeyFromValue(
  value: string | null | undefined
): string | null {
  const iso = calendarDateIsoFromValue(value);
  if (iso) return iso.slice(0, 7);

  const trimmed = value?.trim() ?? "";
  const monthOnly = trimmed.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(monthOnly) ? monthOnly : null;
}
