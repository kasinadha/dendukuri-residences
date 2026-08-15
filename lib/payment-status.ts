/** Payment collection status derived from amount due vs amount paid. */

export const PAYMENT_STATUSES = [
  "pending",
  "partial",
  "paid",
  "overdue",
  "waived",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: string | null | undefined): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(
    (value ?? "").toLowerCase() as PaymentStatus
  );
}

/**
 * Core status from amounts. Does not apply overdue (calendar) or waived.
 * paid >= due (and due > 0) → paid; 0 < paid < due → partial; paid <= 0 → pending.
 */
export function computePaymentStatus(
  amountDue: number,
  amountPaid: number
): Exclude<PaymentStatus, "overdue" | "waived"> {
  const due = Number.isFinite(amountDue) ? amountDue : 0;
  const paid = Number.isFinite(amountPaid) ? amountPaid : 0;

  if (paid <= 0) return "pending";
  if (due > 0 && paid + 1e-9 < due) return "partial";
  return "paid";
}

/** Apply overdue when billing month is before current month and still unpaid. */
export function applyOverdueIfNeeded(
  status: PaymentStatus,
  billingMonthKey: string,
  currentMonthKey: string
): PaymentStatus {
  if (status === "waived" || status === "paid") return status;
  if (billingMonthKey < currentMonthKey) return "overdue";
  return status;
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "partial":
      return "Partial";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "waived":
      return "Waived";
    default:
      return status;
  }
}
