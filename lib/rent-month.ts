import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  applyOverdueIfNeeded,
  computePaymentStatus,
  type PaymentStatus,
} from "@/lib/payment-status";
import { formatBillingMonthLabel, parseBillingMonthFromNotes } from "@/lib/receipts";
import { isMissingColumnError } from "@/lib/money";
import {
  amountsByBillingMonth,
  isVoidedPaymentStatus,
  loadRentLedgerPayments,
  paymentDisplayMonth,
  waivedAmountForMonth,
} from "@/lib/payment-attribution";

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
  paymentType: string | null;
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

  const ledgerPayments = (await loadRentLedgerPayments(supabase)).filter(
    (row) => row.paymentType === "rent"
  );

  const paidByTenancy = new Map<
    string,
    {
      amountPaid: number;
      waivedAmount: number;
      lastPaymentId: string | null;
      lastPaymentDate: string | null;
      lastReceiptId: string | null;
      lastReceiptNumber: string | null;
    }
  >();

  for (const payment of ledgerPayments) {
    const attributed = amountsByBillingMonth(payment).get(monthKey) ?? 0;
    const waivedAmt = waivedAmountForMonth(payment, monthKey);
    if (attributed <= 0 && waivedAmt <= 0) continue;

    const prev = paidByTenancy.get(payment.tenancyId) ?? {
      amountPaid: 0,
      waivedAmount: 0,
      lastPaymentId: null,
      lastPaymentDate: null,
      lastReceiptId: null,
      lastReceiptNumber: null,
    };

    prev.amountPaid += attributed;
    prev.waivedAmount += waivedAmt;

    if (
      !prev.lastPaymentDate ||
      payment.paymentDate >= prev.lastPaymentDate
    ) {
      prev.lastPaymentId = payment.id;
      prev.lastPaymentDate = payment.paymentDate;
      prev.lastReceiptId = payment.lastReceiptId;
      prev.lastReceiptNumber = payment.lastReceiptNumber;
    }

    paidByTenancy.set(payment.tenancyId, prev);
  }

  const rows: RentLedgerRow[] = active.map((row) => {
    const tenant = unwrapOne(row.tenants);
    const flat = unwrapOne(row.flats);
    const amountDue = num(row.monthly_rent);
    const paidInfo = paidByTenancy.get(row.id);
    const amountPaid = paidInfo?.amountPaid ?? 0;
    const waivedAmount = paidInfo?.waivedAmount ?? 0;
    const outstanding = Math.max(0, amountDue - amountPaid - waivedAmount);

    let status: PaymentStatus =
      outstanding <= 0 && waivedAmount > 0 && amountPaid <= 0
        ? "waived"
        : computePaymentStatus(amountDue, amountPaid + waivedAmount);
    status = applyOverdueIfNeeded(status, monthKey, nowKey);

    return {
      tenancyId: row.id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      billingMonthKey: monthKey,
      amountDue,
      amountPaid,
      outstanding,
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

  const selectWithMonth = `
      id,
      tenancy_id,
      amount_paid,
      amount_due,
      status,
      payment_date,
      payment_mode,
      payment_type,
      transaction_reference,
      billing_month,
      notes,
      tenancies (
        id,
        tenants ( full_name ),
        flats ( flat_number )
      ),
      receipts ( id, receipt_number )
    `;
  const selectWithoutMonth = `
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
    `;

  async function runHistorySelect(select: string) {
    return supabase
      .from("payments")
      .select(select)
      .order("payment_date", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 300));
  }

  let result = await runHistorySelect(selectWithMonth);
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await runHistorySelect(selectWithoutMonth);
  }

  if (result.error || !result.data) return [];
  const data = result.data as unknown as Array<Record<string, unknown>>;

  const flatFilter = filters.flat?.trim().toLowerCase() || null;
  const tenantFilter = filters.tenant?.trim().toLowerCase() || null;
  const monthFilter = filters.month?.trim() || null;
  const statusFilter = filters.status?.trim().toLowerCase() || null;

  return data.map((payment) => {
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
      const { userNotes } = parseBillingMonthFromNotes(notes);
      const monthKey =
        paymentDisplayMonth({
          billingMonth:
            typeof payment.billing_month === "string"
              ? payment.billing_month
              : null,
          notes,
          paymentDate: String(payment.payment_date ?? ""),
        }) ?? "";

      const amountDue =
        payment.amount_due == null ? null : num(payment.amount_due);
      const amountPaid = num(payment.amount_paid);
      const rawStatus = String(payment.status ?? "").toLowerCase();
      let status: PaymentStatus = isVoidedPaymentStatus(rawStatus)
        ? "voided"
        : rawStatus === "waived"
          ? "waived"
          : computePaymentStatus(amountDue ?? amountPaid, amountPaid);
      if (monthKey && status !== "voided") {
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
        paymentType: (payment.payment_type as string | null) ?? null,
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
