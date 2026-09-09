import { calendarMonthKeyFromValue } from "@/lib/calendar-date";
import {
  tenancyOverlapsBillingMonth,
  type TenancyForBillingOverlap,
} from "@/lib/electricity-occupancy";

/**
 * Shared occupancy rules for rent, monthly charges, and electricity.
 * Billing month keys are calendar months of the 5th due date
 * (August rent is due 5 Aug). Electricity uses the same key for the *usage*
 * month (August meters), which is usually the month before you take the reading.
 * - Requires move-in date; move-in month and earlier months: no dues.
 * - Vacate month still included (overlap via end_date); later months excluded.
 */
export function tenancyOwesMonthlyDues(
  tenancy: TenancyForBillingOverlap,
  billingMonthKey: string
): boolean {
  if (!tenancyOverlapsBillingMonth(tenancy, billingMonthKey)) return false;

  const startMonth = calendarMonthKeyFromValue(tenancy.start_date);
  if (!startMonth) return false;
  if (billingMonthKey <= startMonth) return false;

  return true;
}

/** @deprecated Use tenancyOwesMonthlyDues — same rules for all due types. */
export function tenancyOwesMonthlyRent(
  tenancy: TenancyForBillingOverlap,
  billingMonthKey: string
): boolean {
  return tenancyOwesMonthlyDues(tenancy, billingMonthKey);
}

export function tenancyIncludedInMonthlyLedger(
  tenancy: TenancyForBillingOverlap,
  billingMonthKey: string
): boolean {
  return tenancyOverlapsBillingMonth(tenancy, billingMonthKey);
}

/** First calendar month when rent/charges are due (month after move-in). */
export function firstMonthlyBillingMonthKey(
  startDate: string | null | undefined
): string | null {
  const startMonth = calendarMonthKeyFromValue(startDate);
  if (!startMonth) return null;

  const year = Number(startMonth.slice(0, 4));
  const month = Number(startMonth.slice(5, 7));
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}
