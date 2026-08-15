import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  applyOverdueIfNeeded,
  computePaymentStatus,
  type PaymentStatus,
} from "@/lib/payment-status";
import {
  formatBillingMonthLabel,
  parseBillingMonthFromNotes,
} from "@/lib/receipts";

function currentMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export type RentLedgerRow = {
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  billingMonthKey: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  status: PaymentStatus;
  lastPaymentId: string | null;
  lastReceiptId: string | null;
  lastReceiptNumber: string | null;
  lastPaymentDate: string | null;
};

export type RentMonthSummary = {
  billingMonthKey: string;
  billingMonthLabel: string;
  rentExpected: number;
  rentCollected: number;
  outstanding: number;
  paidTenants: number;
  pendingTenants: number;
  partialTenants: number;
  overdueTenants: number;
  rows: RentLedgerRow[];
};

export type PaymentHistoryRow = {
  paymentId: string;
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  billingMonthKey: string;
  billingMonthLabel: string;
  amountDue: number | null;
  amountPaid: number;
  status: PaymentStatus;
  paymentDate: string;
  paymentMode: string | null;
  transactionReference: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  notes: string | null;
};

export type PaymentHistoryFilters = {
  month?: string | null;
  flat?: string | null;
  tenant?: string | null;
  status?: string | null;
  limit?: number;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Month rent ledger for ACTIVE tenancies only.
 * Confirmed/reserved (e.g. D201) are excluded — no automatic rent due.
 */
export async function getRentMonthSummary(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<RentMonthSummary> {
  const monthKey = billingMonthKey?.trim() || currentMonthKey();
  const nowKey = currentMonthKey();

  const { data: tenancyRows } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      tenants ( full_name ),
      flats ( flat_number )
    `
    );

  const active = (tenancyRows ?? []).filter((row) =>
    isActiveTenancyStatus(row.status)
  );

  const { data: paymentRows } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenancy_id,
      amount_paid,
      amount_due,
      status,
      payment_date,
      payment_type,
      notes,
      receipts ( id, receipt_number )
    `
    )
    .eq("payment_type", "rent");

  const paidByTenancy = new Map<
    string,
    {
      amountPaid: number;
      lastPaymentId: string | null;
      lastPaymentDate: string | null;
      lastReceiptId: string | null;
      lastReceiptNumber: string | null;
      waived: boolean;
    }
  >();

  for (const payment of paymentRows ?? []) {
    const { billingMonthKey: key } = parseBillingMonthFromNotes(payment.notes);
    const effectiveKey =
      key ??
      (typeof payment.payment_date === "string"
        ? payment.payment_date.slice(0, 7)
        : null);
    if (effectiveKey !== monthKey) continue;

    const tenancyId = payment.tenancy_id as string;
    const prev = paidByTenancy.get(tenancyId) ?? {
      amountPaid: 0,
      lastPaymentId: null,
      lastPaymentDate: null,
      lastReceiptId: null,
      lastReceiptNumber: null,
      waived: false,
    };

    prev.amountPaid += num(payment.amount_paid);
    if ((payment.status ?? "").toLowerCase() === "waived") prev.waived = true;

    const receipt = unwrapOne(
      payment.receipts as
        | { id: string; receipt_number: string }
        | { id: string; receipt_number: string }[]
        | null
    );

    const paymentDate = String(payment.payment_date ?? "");
    if (
      !prev.lastPaymentDate ||
      paymentDate >= prev.lastPaymentDate
    ) {
      prev.lastPaymentId = payment.id;
      prev.lastPaymentDate = paymentDate;
      prev.lastReceiptId = receipt?.id ?? null;
      prev.lastReceiptNumber = receipt?.receipt_number ?? null;
    }

    paidByTenancy.set(tenancyId, prev);
  }

  const rows: RentLedgerRow[] = active.map((row) => {
    const tenant = unwrapOne(row.tenants);
    const flat = unwrapOne(row.flats);
    const amountDue = num(row.monthly_rent);
    const paidInfo = paidByTenancy.get(row.id);
    const amountPaid = paidInfo?.amountPaid ?? 0;

    let status: PaymentStatus = paidInfo?.waived
      ? "waived"
      : computePaymentStatus(amountDue, amountPaid);
    status = applyOverdueIfNeeded(status, monthKey, nowKey);

    return {
      tenancyId: row.id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      billingMonthKey: monthKey,
      amountDue,
      amountPaid,
      outstanding:
        status === "waived" ? 0 : Math.max(0, amountDue - amountPaid),
      status,
      lastPaymentId: paidInfo?.lastPaymentId ?? null,
      lastReceiptId: paidInfo?.lastReceiptId ?? null,
      lastReceiptNumber: paidInfo?.lastReceiptNumber ?? null,
      lastPaymentDate: paidInfo?.lastPaymentDate ?? null,
    };
  });

  rows.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));

  const rentExpected = rows.reduce((s, r) => s + r.amountDue, 0);
  const rentCollected = rows.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return {
    billingMonthKey: monthKey,
    billingMonthLabel: formatBillingMonthLabel(monthKey),
    rentExpected,
    rentCollected,
    outstanding,
    paidTenants: rows.filter((r) => r.status === "paid" || r.status === "waived")
      .length,
    pendingTenants: rows.filter(
      (r) => r.status === "pending" || r.status === "overdue"
    ).length,
    partialTenants: rows.filter((r) => r.status === "partial").length,
    overdueTenants: rows.filter((r) => r.status === "overdue").length,
    rows,
  };
}

export async function listPaymentHistory(
  supabase: SupabaseClient,
  filters: PaymentHistoryFilters = {}
): Promise<PaymentHistoryRow[]> {
  const limit = filters.limit ?? 100;
  const nowKey = currentMonthKey();

  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenancy_id,
      amount_paid,
      amount_due,
      status,
      payment_date,
      payment_mode,
      payment_type,
      transaction_reference,
      notes,
      tenancies (
        id,
        tenants ( full_name ),
        flats ( flat_number )
      ),
      receipts ( id, receipt_number )
    `
    )
    .order("payment_date", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300));

  if (error || !data) return [];

  const flatFilter = filters.flat?.trim().toLowerCase() || null;
  const tenantFilter = filters.tenant?.trim().toLowerCase() || null;
  const monthFilter = filters.month?.trim() || null;
  const statusFilter = filters.status?.trim().toLowerCase() || null;

  return (data as unknown as Array<Record<string, unknown>>)
    .map((payment) => {
      const tenancy = unwrapOne(
        payment.tenancies as
          | {
              tenants: { full_name: string } | { full_name: string }[] | null;
              flats: { flat_number: string } | { flat_number: string }[] | null;
            }
          | null
      );
      const tenant = unwrapOne(tenancy?.tenants ?? null);
      const flat = unwrapOne(tenancy?.flats ?? null);
      const receipt = unwrapOne(
        payment.receipts as
          | { id: string; receipt_number: string }
          | { id: string; receipt_number: string }[]
          | null
      );

      const notes = (payment.notes as string | null) ?? null;
      const { billingMonthKey, userNotes } = parseBillingMonthFromNotes(notes);
      const monthKey =
        billingMonthKey ??
        String(payment.payment_date ?? "").slice(0, 7) ??
        "";

      const amountDue =
        payment.amount_due == null ? null : num(payment.amount_due);
      const amountPaid = num(payment.amount_paid);
      let status: PaymentStatus =
        (payment.status as string)?.toLowerCase() === "waived"
          ? "waived"
          : computePaymentStatus(amountDue ?? amountPaid, amountPaid);
      if (monthKey) {
        status = applyOverdueIfNeeded(status, monthKey, nowKey);
      }

      return {
        paymentId: String(payment.id),
        tenancyId: String(payment.tenancy_id ?? ""),
        flatNumber: flat?.flat_number?.trim() || "—",
        tenantName: tenant?.full_name?.trim() || "—",
        billingMonthKey: monthKey,
        billingMonthLabel: formatBillingMonthLabel(monthKey),
        amountDue,
        amountPaid,
        status,
        paymentDate: String(payment.payment_date ?? ""),
        paymentMode: (payment.payment_mode as string | null) ?? null,
        transactionReference:
          (payment.transaction_reference as string | null) ?? null,
        receiptId: receipt?.id ?? null,
        receiptNumber: receipt?.receipt_number ?? null,
        notes: userNotes || null,
      } satisfies PaymentHistoryRow;
    })
    .filter((row) => {
      if (monthFilter && row.billingMonthKey !== monthFilter) return false;
      if (flatFilter && !row.flatNumber.toLowerCase().includes(flatFilter))
        return false;
      if (
        tenantFilter &&
        !row.tenantName.toLowerCase().includes(tenantFilter)
      )
        return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
}
