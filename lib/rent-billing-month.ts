import {
  tenancyOverlapsBillingMonth,
  type TenancyForBillingOverlap,
} from "@/lib/electricity-occupancy";

/**
 * Whether rent and monthly charges (maintenance, parking, etc.) are due for
 * this billing month. Requires a move-in date; move-in month and earlier are
 * excluded — rent starts the month after move-in.
 */
export function tenancyOwesMonthlyRent(
  tenancy: TenancyForBillingOverlap,
  billingMonthKey: string
): boolean {
  if (!tenancyOverlapsBillingMonth(tenancy, billingMonthKey)) return false;

  const startDate = tenancy.start_date?.trim();
  if (!startDate) return false;

  const startMonth = startDate.slice(0, 7);
  if (billingMonthKey <= startMonth) return false;

  return true;
}
