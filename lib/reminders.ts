import type { SupabaseClient } from "@supabase/supabase-js";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { listWaterTankers } from "@/lib/ops";
import type { PaymentStatus } from "@/lib/payment-status";
import {
  formatBillingMonthLabel,
  formatInr,
} from "@/lib/receipts";
import { getRentMonthSummary, type RentLedgerRow } from "@/lib/rent-month";

export type UnpaidReminderRow = RentLedgerRow & {
  phone: string | null;
  remindedAt: string | null;
  reminderChannel: string | null;
  whatsappUrl: string | null;
};

export type OwnerDueItem = {
  id: string;
  kind: "water" | "maintenance";
  title: string;
  detail: string;
  amount: number | null;
  status: string;
  href: string;
};

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function toWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  let digits = digitsOnly(phone);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function reminderMessage(row: {
  flatNumber: string;
  billingMonthKey: string;
  outstanding: number;
}): string {
  const month = formatBillingMonthLabel(row.billingMonthKey);
  return `Hi, reminder for Flat ${row.flatNumber}: rent for ${month} has an outstanding of ${formatInr(row.outstanding)}. Please pay at your earliest. — Dendukuri's Residences`;
}

/**
 * Unpaid / partial / overdue active tenancies for a month, with reminder status.
 */
export async function listUnpaidRentReminders(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<{
  billingMonthKey: string;
  billingMonthLabel: string;
  rows: UnpaidReminderRow[];
}> {
  const summary = await getRentMonthSummary(supabase, billingMonthKey);
  const unpaid = summary.rows.filter(
    (row) =>
      row.outstanding > 0 &&
      row.status !== "paid" &&
      row.status !== "waived"
  );

  if (unpaid.length === 0) {
    return {
      billingMonthKey: summary.billingMonthKey,
      billingMonthLabel: summary.billingMonthLabel,
      rows: [],
    };
  }

  const tenancyIds = unpaid.map((r) => r.tenancyId);

  const [{ data: tenancyMeta }, remindersResult] = await Promise.all([
    supabase
      .from("tenancies")
      .select("id, tenants ( phone )")
      .in("id", tenancyIds),
    supabase
      .from("rent_reminders")
      .select("tenancy_id, reminded_at, channel")
      .eq("billing_month", summary.billingMonthKey)
      .in("tenancy_id", tenancyIds),
  ]);

  const reminders = remindersResult.error ? [] : remindersResult.data ?? [];

  const phoneByTenancy = new Map<string, string | null>();
  for (const row of tenancyMeta ?? []) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    phoneByTenancy.set(row.id, tenant?.phone?.trim() || null);
  }

  const reminderByTenancy = new Map<
    string,
    { remindedAt: string; channel: string | null }
  >();
  for (const row of reminders) {
    reminderByTenancy.set(row.tenancy_id, {
      remindedAt: row.reminded_at,
      channel: row.channel,
    });
  }

  const rows: UnpaidReminderRow[] = unpaid.map((row) => {
    const phone = phoneByTenancy.get(row.tenancyId) ?? null;
    const reminder = reminderByTenancy.get(row.tenancyId) ?? null;
    return {
      ...row,
      phone,
      remindedAt: reminder?.remindedAt ?? null,
      reminderChannel: reminder?.channel ?? null,
      whatsappUrl: toWhatsAppUrl(phone, reminderMessage(row)),
    };
  });

  rows.sort((a, b) => {
    const rank = (s: PaymentStatus) =>
      s === "overdue" ? 0 : s === "partial" ? 1 : 2;
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return b.outstanding - a.outstanding;
  });

  return {
    billingMonthKey: summary.billingMonthKey,
    billingMonthLabel: summary.billingMonthLabel,
    rows,
  };
}

export async function markRentReminded(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    billingMonth: string;
    remindedBy?: string | null;
    channel?: string | null;
    notes?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenancyId = input.tenancyId.trim();
  const billingMonth = input.billingMonth.trim();
  if (!tenancyId || !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false, error: "Missing tenancy or billing month." };
  }

  const payload = {
    tenancy_id: tenancyId,
    billing_month: billingMonth,
    reminded_at: new Date().toISOString(),
    reminded_by: input.remindedBy || null,
    channel: input.channel?.trim() || "manual",
    notes: input.notes?.trim() || null,
  };

  const { error } = await supabase.from("rent_reminders").upsert(payload, {
    onConflict: "tenancy_id,billing_month",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Owner-side dues: unpaid water tankers + open maintenance with cost. */
export async function listOwnerDueReminders(
  supabase: SupabaseClient
): Promise<OwnerDueItem[]> {
  const [tankers, maintenance] = await Promise.all([
    listWaterTankers(supabase),
    listMaintenanceRequests(supabase, { limit: 40 }),
  ]);

  const waterItems: OwnerDueItem[] = tankers
    .filter((row) => {
      const status = (row.paymentStatus ?? "pending").toLowerCase();
      return status !== "paid" && status !== "waived";
    })
    .map((row) => ({
      id: row.id,
      kind: "water" as const,
      title: `Water tanker · ${row.deliveryDate}`,
      detail: row.vendorName
        ? `Vendor ${row.vendorName} · ${row.paymentStatus || "pending"}`
        : row.paymentStatus || "pending",
      amount: row.amount,
      status: row.paymentStatus || "pending",
      href: "/admin/water",
    }));

  const maintenanceItems: OwnerDueItem[] = maintenance
    .filter((row) => {
      const status = row.status.toLowerCase();
      const open =
        status === "open" ||
        status === "in_progress" ||
        status === "pending";
      return open && row.cost != null && row.cost > 0;
    })
    .map((row) => ({
      id: row.id,
      kind: "maintenance" as const,
      title: row.title,
      detail: `Flat ${row.flatNumber} · ${row.status}`,
      amount: row.cost,
      status: row.status,
      href: "/admin/maintenance",
    }));

  return [...waterItems, ...maintenanceItems].slice(0, 20);
}

export async function getTenantMonthDue(
  supabase: SupabaseClient,
  tenancyId: string,
  billingMonthKey?: string
): Promise<RentLedgerRow | null> {
  if (!tenancyId) return null;
  const summary = await getRentMonthSummary(supabase, billingMonthKey);
  return summary.rows.find((row) => row.tenancyId === tenancyId) ?? null;
}
