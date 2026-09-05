import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DuesBreakdown } from "@/lib/dues-breakdown";
import {
  categoryTotalsFromBreakdown,
  parseDuesBreakdownFromNotes,
} from "@/lib/dues-breakdown";
import { resolveReceiptDuesBreakdown } from "@/lib/public-pay-dues";
import { PROPERTY_NAME } from "@/lib/property";

export const BILLING_MONTH_NOTE_PREFIX = "billing_month:";

export type ReceiptRecord = {
  id: string;
  receipt_number: string;
  payment_id: string;
  created_at: string;
};

export type PaymentRecord = {
  id: string;
  tenancy_id: string;
  payment_date: string;
  amount_paid: number | string;
  amount_due?: number | string | null;
  payment_mode: string | null;
  payment_type: string | null;
  transaction_reference: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

export type ReceiptViewModel = {
  receiptId: string;
  receiptNumber: string;
  propertyName: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantProfileId: string | null;
  flatNumber: string;
  billingMonth: string;
  billingMonthKey: string;
  rentAmount: number;
  amountDue: number | null;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  paymentId: string;
  createdAt: string;
  duesBreakdown: DuesBreakdown | null;
};

/** House-rent portion only (excludes electricity, washer, parking, other, fines). */
export function hraRentPaid(receipt: ReceiptViewModel): number {
  if (receipt.duesBreakdown) {
    return categoryTotalsFromBreakdown(receipt.duesBreakdown).rent;
  }
  return receipt.amountPaid > 0 ? receipt.amountPaid : 0;
}

/** YYYY-MM → "August 2026" (en-IN). */
export function formatBillingMonthLabel(yearMonth: string | null | undefined): string {
  if (!yearMonth?.trim()) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!match) return yearMonth;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return yearMonth;

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function encodeBillingMonthNote(
  billingMonth: string,
  userNotes?: string
): string {
  const header = `${BILLING_MONTH_NOTE_PREFIX}${billingMonth.trim()}`;
  const extra = userNotes?.trim();
  return extra ? `${header}\n${extra}` : header;
}

export function parseBillingMonthFromNotes(
  notes: string | null | undefined
): { billingMonthKey: string | null; userNotes: string } {
  if (!notes) return { billingMonthKey: null, userNotes: "" };

  const lines = notes.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first.startsWith(BILLING_MONTH_NOTE_PREFIX)) {
    return {
      billingMonthKey: first.slice(BILLING_MONTH_NOTE_PREFIX.length).trim(),
      userNotes: lines.slice(1).join("\n").trim(),
    };
  }

  return { billingMonthKey: null, userNotes: notes };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDisplayDate(isoDate: string): string {
  const date = new Date(
    isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00+05:30`
  );
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatReceiptShareMessage(
  receipt: Pick<
    ReceiptViewModel,
    | "tenantName"
    | "propertyName"
    | "flatNumber"
    | "billingMonth"
    | "receiptNumber"
    | "amountPaid"
    | "paymentDate"
    | "transactionReference"
    | "paymentMethod"
    | "duesBreakdown"
  >,
  viewUrl?: string | null
): string {
  const lines = [
    `Hi ${receipt.tenantName},`,
    "",
    `Your rent receipt for ${receipt.billingMonth} is ready.`,
    "",
    `Flat: ${receipt.flatNumber}`,
    `Receipt no: ${receipt.receiptNumber}`,
    `Amount paid: ${formatInr(receipt.amountPaid)}`,
    `Payment date: ${formatDisplayDate(receipt.paymentDate)}`,
    `Method: ${formatPaymentMethodLabel(receipt.paymentMethod)}`,
  ];

  if (
    receipt.transactionReference &&
    receipt.transactionReference !== "—"
  ) {
    lines.push(`Reference: ${receipt.transactionReference}`);
  }

  if (receipt.duesBreakdown?.lines.length) {
    lines.push("");
    lines.push("Breakdown:");
    for (const line of receipt.duesBreakdown.lines) {
      if (line.paid <= 0) continue;
      lines.push(`• ${line.label}: ${formatInr(line.paid)}`);
    }
  }

  if (viewUrl) {
    lines.push("");
    lines.push(`View receipt: ${viewUrl}`);
  }

  lines.push("");
  lines.push(`— ${receipt.propertyName}`);
  return lines.join("\n");
}

/** Short WhatsApp caption when the full receipt is attached as a PDF. */
export function formatReceiptPdfShareMessage(
  receipt: Pick<
    ReceiptViewModel,
    | "tenantName"
    | "propertyName"
    | "flatNumber"
    | "billingMonth"
    | "receiptNumber"
    | "amountPaid"
  >
): string {
  return [
    `Hi ${receipt.tenantName},`,
    "",
    `Please find attached your rent receipt for ${receipt.billingMonth}.`,
    "",
    `Flat: ${receipt.flatNumber}`,
    `Receipt no: ${receipt.receiptNumber}`,
    `Amount paid: ${formatInr(receipt.amountPaid)}`,
    "",
    `— ${receipt.propertyName}`,
  ].join("\n");
}

function formatPaymentMethodLabel(value: string): string {
  const map: Record<string, string> = {
    upi: "UPI",
    bank_transfer: "Bank transfer",
    cash: "Cash",
    cheque: "Cheque",
    card: "Card",
    neft: "NEFT",
    other: "Other",
  };
  return map[value] ?? value;
}

/** Current billing month key YYYY-MM in Asia/Kolkata. */
export function currentBillingMonthKeyFromParts(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/**
 * Allocates unique receipt number DR-YYYY-NNNN via DB counter when available.
 * Falls back to unique DR-YYYYMM-HEX (legacy) with retry on unique_violation.
 */
export function generateReceiptNumber(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `DR-${year}${month}-${suffix}`;
}

export async function insertReceiptWithUniqueNumber(
  supabase: SupabaseClient,
  paymentId: string,
  maxAttempts = 8
): Promise<ReceiptRecord> {
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let receipt_number: string | null = null;

    const { data: allocated, error: allocError } = await supabase.rpc(
      "allocate_receipt_number"
    );
    if (
      !allocError &&
      typeof allocated === "string" &&
      /^DR-\d{4}-\d{4}$/.test(allocated)
    ) {
      receipt_number = allocated;
    } else {
      receipt_number = generateReceiptNumber();
    }

    const { data, error } = await supabase
      .from("receipts")
      .insert({ payment_id: paymentId, receipt_number })
      .select("id,receipt_number,payment_id,created_at")
      .single();

    if (!error && data) {
      return data as ReceiptRecord;
    }

    lastError = error;
    if (error?.code === "23505") {
      continue;
    }

    throw new Error(error?.message ?? "Failed to create receipt");
  }

  throw new Error(
    lastError?.message ??
      "Could not allocate a unique receipt number after several attempts"
  );
}

type TenantJoin = {
  id: string;
  full_name: string;
  profile_id: string | null;
  phone: string | null;
};

type FlatJoin = {
  id: string;
  flat_number: string;
};

type TenancyJoin = {
  id: string;
  monthly_rent: number | string | null;
  // PostgREST may return nested relations as object or array.
  tenants: TenantJoin | TenantJoin[] | null;
  flats: FlatJoin | FlatJoin[] | null;
};

type PaymentJoinRow = PaymentRecord & {
  tenancies: TenancyJoin | TenancyJoin[] | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function toReceiptViewModel(
  receipt: ReceiptRecord,
  payment: PaymentJoinRow
): ReceiptViewModel {
  const tenancy = unwrapOne(payment.tenancies);
  const tenant = unwrapOne(tenancy?.tenants ?? null);
  const flat = unwrapOne(tenancy?.flats ?? null);
  const { billingMonthKey } = parseBillingMonthFromNotes(payment.notes);
  const key =
    billingMonthKey ??
    payment.payment_date.slice(0, 7);

  const amountPaid =
    typeof payment.amount_paid === "string"
      ? Number(payment.amount_paid)
      : Number(payment.amount_paid);
  const amountDueRaw =
    payment.amount_due == null
      ? null
      : typeof payment.amount_due === "string"
        ? Number(payment.amount_due)
        : Number(payment.amount_due);
  const amountDue =
    amountDueRaw != null && Number.isFinite(amountDueRaw) ? amountDueRaw : null;
  const paid = Number.isFinite(amountPaid) ? amountPaid : 0;
  const duesBreakdown = parseDuesBreakdownFromNotes(payment.notes);

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receipt_number,
    propertyName: PROPERTY_NAME,
    tenantName: tenant?.full_name ?? "—",
    tenantPhone: tenant?.phone?.trim() || null,
    tenantProfileId: tenant?.profile_id ?? null,
    flatNumber: flat?.flat_number ?? "—",
    billingMonth: formatBillingMonthLabel(key),
    billingMonthKey: key,
    rentAmount: amountDue ?? paid,
    amountDue,
    amountPaid: paid,
    paymentDate: payment.payment_date,
    paymentMethod: payment.payment_mode ?? "—",
    transactionReference: payment.transaction_reference?.trim() || "—",
    paymentId: payment.id,
    createdAt: receipt.created_at,
    duesBreakdown,
  };
}

async function enrichReceiptViewModel(
  supabase: SupabaseClient,
  receipt: ReceiptRecord,
  payment: PaymentJoinRow
): Promise<ReceiptViewModel> {
  const view = toReceiptViewModel(receipt, payment);
  const tenancy = unwrapOne(payment.tenancies);
  const flat = unwrapOne(tenancy?.flats ?? null);
  const tenancyId = payment.tenancy_id ?? tenancy?.id ?? null;
  const flatId = flat?.id ?? null;

  const computed = await resolveReceiptDuesBreakdown(supabase, {
    notes: payment.notes,
    tenancyId,
    flatId,
    billingMonthKey: view.billingMonthKey,
  });

  return { ...view, duesBreakdown: computed };
}

export async function fetchReceiptViewById(
  supabase: SupabaseClient,
  receiptId: string
): Promise<ReceiptViewModel | null> {
  const { data: receipt, error } = await supabase
    .from("receipts")
    .select("id,receipt_number,payment_id,created_at")
    .eq("id", receiptId)
    .maybeSingle();

  if (error || !receipt) return null;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenancy_id,
      payment_date,
      amount_paid,
      amount_due,
      payment_mode,
      payment_type,
      transaction_reference,
      status,
      notes,
      created_at,
      tenancies (
        id,
        monthly_rent,
        tenants ( id, full_name, profile_id, phone ),
        flats ( id, flat_number )
      )
    `
    )
    .eq("id", receipt.payment_id)
    .maybeSingle();

  if (paymentError || !payment) return null;

  return enrichReceiptViewModel(
    supabase,
    receipt as ReceiptRecord,
    payment as unknown as PaymentJoinRow
  );
}

export async function listReceiptViews(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<ReceiptViewModel[]> {
  const limit = options?.limit ?? 50;

  const { data: receipts, error } = await supabase
    .from("receipts")
    .select("id,receipt_number,payment_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !receipts?.length) return [];

  const paymentIds = receipts.map((r) => r.payment_id);
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenancy_id,
      payment_date,
      amount_paid,
      amount_due,
      payment_mode,
      payment_type,
      transaction_reference,
      status,
      notes,
      created_at,
      tenancies (
        id,
        monthly_rent,
        tenants ( id, full_name, profile_id, phone ),
        flats ( id, flat_number )
      )
    `
    )
    .in("id", paymentIds);

  if (paymentsError || !payments) return [];

  const byId = new Map(
    payments.map((p) => [p.id, p as unknown as PaymentJoinRow])
  );

  return Promise.all(
    receipts.map(async (receipt) => {
      const payment = byId.get(receipt.payment_id);
      if (!payment) return null;
      return enrichReceiptViewModel(
        supabase,
        receipt as ReceiptRecord,
        payment
      );
    })
  ).then((rows) => rows.filter((row): row is ReceiptViewModel => row !== null));
}
