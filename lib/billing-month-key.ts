/** YYYY-MM in Asia/Kolkata — the rent due month (due on the 5th). */
export function istYearMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function shiftBillingMonthKey(
  monthKey: string,
  deltaMonths: number
): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + deltaMonths;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Electricity usage month: meters read in early September are August usage.
 * Rent due month stays `istYearMonthKey()` (due on the 5th of that month).
 */
export function previousIstYearMonthKey(now = new Date()): string {
  return shiftBillingMonthKey(istYearMonthKey(now), -1);
}
