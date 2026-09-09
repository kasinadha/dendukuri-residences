import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyAdditionalPaymentToBreakdown,
  type DuesBreakdown,
} from "@/lib/dues-breakdown";
import { friendlyDatabaseError, isMissingColumnError } from "@/lib/money";
import { parseBillingMonthFromNotes } from "@/lib/receipts";
import { isVoidedPaymentStatus } from "@/lib/payment-status";

export { isVoidedPaymentStatus };

export type PaymentMonthAllocation = {
  billingMonthKey: string;
  amountPaid: number;
};

export type LedgerPayment = {
  id: string;
  tenancyId: string;
  amountPaid: number;
  amountDue: number;
  status: string;
  paymentDate: string;
  paymentType: string;
  billingMonth: string | null;
  notes: string | null;
  lastReceiptId: string | null;
  lastReceiptNumber: string | null;
  allocations: PaymentMonthAllocation[];
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function paymentDisplayMonth(payment: {
  billingMonth?: string | null;
  billing_month?: string | null;
  notes?: string | null;
  paymentDate?: string | null;
  payment_date?: string | null;
}): string | null {
  const dedicated = (payment.billingMonth ?? payment.billing_month ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(dedicated)) return dedicated;
  const fromNotes = parseBillingMonthFromNotes(payment.notes).billingMonthKey;
  if (fromNotes && /^\d{4}-\d{2}$/.test(fromNotes)) return fromNotes;
  const date = String(payment.paymentDate ?? payment.payment_date ?? "");
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

/** How much of this payment counts toward each billing month. */
export function amountsByBillingMonth(
  payment: Pick<
    LedgerPayment,
    "amountPaid" | "billingMonth" | "notes" | "paymentDate" | "allocations" | "status"
  >
): Map<string, number> {
  const map = new Map<string, number>();
  if (isVoidedPaymentStatus(payment.status)) return map;

  if (payment.allocations.length > 0) {
    for (const row of payment.allocations) {
      if (row.amountPaid <= 0) continue;
      map.set(
        row.billingMonthKey,
        (map.get(row.billingMonthKey) ?? 0) + row.amountPaid
      );
    }
    return map;
  }

  const month = paymentDisplayMonth({
    billingMonth: payment.billingMonth,
    notes: payment.notes,
    paymentDate: payment.paymentDate,
  });
  if (month) map.set(month, payment.amountPaid);
  return map;
}

export function waivedAmountForMonth(
  payment: Pick<
    LedgerPayment,
    "status" | "amountDue" | "billingMonth" | "notes" | "paymentDate" | "allocations"
  >,
  monthKey: string
): number {
  if ((payment.status ?? "").toLowerCase() !== "waived") return 0;
  if (isVoidedPaymentStatus(payment.status)) return 0;
  const month = paymentDisplayMonth({
    billingMonth: payment.billingMonth,
    notes: payment.notes,
    paymentDate: payment.paymentDate,
  });
  if (month !== monthKey) return 0;
  return payment.amountDue > 0 ? payment.amountDue : 0;
}

/**
 * Split a lump-sum payment across arrears months then the selected month,
 * matching the UI waterfall in applyAdditionalPaymentToBreakdown.
 */
export function allocationsFromPayment(
  breakdown: DuesBreakdown,
  amountPaid: number
): PaymentMonthAllocation[] {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return [];

  const after = applyAdditionalPaymentToBreakdown(breakdown, amountPaid);
  const allocations: PaymentMonthAllocation[] = [];

  for (const beforeMonth of breakdown.arrears ?? []) {
    const afterMonth = after.arrears?.find(
      (month) => month.billingMonthKey === beforeMonth.billingMonthKey
    );
    const applied =
      beforeMonth.totalOutstanding - (afterMonth?.totalOutstanding ?? 0);
    if (applied >= 0.5) {
      allocations.push({
        billingMonthKey: beforeMonth.billingMonthKey,
        amountPaid: Math.round(applied),
      });
    }
  }

  const allocated = allocations.reduce((sum, row) => sum + row.amountPaid, 0);
  const remainder = Math.round(amountPaid - allocated);
  if (remainder > 0) {
    allocations.push({
      billingMonthKey: breakdown.billingMonthKey,
      amountPaid: remainder,
    });
  } else if (allocations.length === 0) {
    allocations.push({
      billingMonthKey: breakdown.billingMonthKey,
      amountPaid: Math.round(amountPaid),
    });
  }

  return allocations;
}

const PAYMENT_SELECT_WITH_ALLOC = `
  id,
  tenancy_id,
  amount_paid,
  amount_due,
  status,
  payment_date,
  payment_type,
  billing_month,
  notes,
  receipts ( id, receipt_number ),
  payment_allocations ( billing_month, amount )
`;

const PAYMENT_SELECT_WITH_MONTH = `
  id,
  tenancy_id,
  amount_paid,
  amount_due,
  status,
  payment_date,
  payment_type,
  billing_month,
  notes,
  receipts ( id, receipt_number )
`;

const PAYMENT_SELECT_NOTES_ONLY = `
  id,
  tenancy_id,
  amount_paid,
  amount_due,
  status,
  payment_date,
  payment_type,
  notes,
  receipts ( id, receipt_number )
`;

function mapLedgerRow(row: Record<string, unknown>): LedgerPayment {
  const receipt = unwrapOne(
    row.receipts as
      | { id: string; receipt_number: string }
      | { id: string; receipt_number: string }[]
      | null
  );
  const rawAlloc = row.payment_allocations;
  const allocations = Array.isArray(rawAlloc)
    ? rawAlloc.map((item: { billing_month?: string; amount?: unknown }) => ({
        billingMonthKey: String(item.billing_month ?? ""),
        amountPaid: num(item.amount),
      }))
    : [];

  return {
    id: String(row.id),
    tenancyId: String(row.tenancy_id ?? ""),
    amountPaid: num(row.amount_paid),
    amountDue: num(row.amount_due),
    status: String(row.status ?? ""),
    paymentDate: String(row.payment_date ?? ""),
    paymentType: String(row.payment_type ?? "rent").toLowerCase(),
    billingMonth:
      typeof row.billing_month === "string" ? row.billing_month : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    lastReceiptId: receipt?.id ?? null,
    lastReceiptNumber: receipt?.receipt_number ?? null,
    allocations: allocations.filter(
      (item) => /^\d{4}-\d{2}$/.test(item.billingMonthKey) && item.amountPaid > 0
    ),
  };
}

export async function loadRentLedgerPayments(
  supabase: SupabaseClient,
  options?: { tenancyId?: string }
): Promise<LedgerPayment[]> {
  async function run(select: string) {
    let query = supabase
      .from("payments")
      .select(select)
      .in("payment_type", ["rent", "maintenance"]);
    if (options?.tenancyId) {
      query = query.eq("tenancy_id", options.tenancyId);
    }
    return query;
  }

  let result = await run(PAYMENT_SELECT_WITH_ALLOC);
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await run(PAYMENT_SELECT_WITH_MONTH);
  }
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await run(PAYMENT_SELECT_NOTES_ONLY);
  }
  if (result.error || !result.data) return [];

  return (result.data as unknown as Record<string, unknown>[]).map(mapLedgerRow);
}

export async function insertPaymentAllocations(
  supabase: SupabaseClient,
  paymentId: string,
  allocations: PaymentMonthAllocation[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = allocations
    .filter((row) => row.amountPaid > 0 && /^\d{4}-\d{2}$/.test(row.billingMonthKey))
    .map((row) => ({
      payment_id: paymentId,
      billing_month: row.billingMonthKey,
      amount: row.amountPaid,
    }));
  if (rows.length === 0) return { ok: true };

  const { error } = await supabase.from("payment_allocations").insert(rows);
  if (!error) return { ok: true };
  if (isMissingColumnError(error.message) || /payment_allocations/i.test(error.message)) {
    return { ok: true };
  }
  return { ok: false, error: friendlyDatabaseError(error.message) };
}

export async function findLivePaymentByUtr(
  supabase: SupabaseClient,
  utr: string
): Promise<{ id: string } | null> {
  const value = utr.trim();
  if (!value) return null;
  const { data, error } = await supabase
    .from("payments")
    .select("id,status,transaction_reference")
    .ilike("transaction_reference", value)
    .limit(8);
  if (error || !data) return null;
  const live = data.find(
    (row) =>
      !isVoidedPaymentStatus(row.status) &&
      String(row.transaction_reference ?? "").trim().toLowerCase() ===
        value.toLowerCase()
  );
  return live ? { id: String(live.id) } : null;
}
