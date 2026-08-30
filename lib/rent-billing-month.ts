import {
  tenancyOverlapsBillingMonth,
  type TenancyForBillingOverlap,
} from "@/lib/electricity-occupancy";

/**
 * Shared rules for rent, monthly charges, and electricity.
 * - Requires move-in date; move-in month and earlier months: no dues.
 * - Vacate month still included (overlap via end_date); later months excluded.
 */
export function tenancyOwesMonthlyDues(
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
