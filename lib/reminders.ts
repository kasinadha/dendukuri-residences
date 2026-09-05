import type { SupabaseClient } from "@supabase/supabase-js";
import { listMaintenanceRequests } from "@/lib/maintenance";
import {
  formatMonthlyDuesBreakdown,
  getMonthlyDuesSummary,
  getTenancyMonthlyDueRow,
  type MonthlyDuesLedgerRow,
} from "@/lib/monthly-dues";
import { formatExpenseLocation } from "@/lib/expense-location";
import { listWaterTankers } from "@/lib/ops";
import type { PaymentStatus } from "@/lib/payment-status";
import {
  formatBillingMonthLabel,
  formatInr,
} from "@/lib/receipts";
import {
  formatWhatsAppBusinessPhoneDisplay,
  getWhatsAppBusinessConfig,
  sendWhatsAppBusinessMessage,
  toTenantWhatsAppUrl,
} from "@/lib/whatsapp";

export type UnpaidReminderRow = MonthlyDuesLedgerRow & {
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

export function buildRentReminderMessage(row: MonthlyDuesLedgerRow): string {
  const month = formatBillingMonthLabel(row.billingMonthKey);
  const breakdown = formatMonthlyDuesBreakdown(row);
  const businessWhatsApp = formatWhatsAppBusinessPhoneDisplay(
    getWhatsAppBusinessConfig().businessPhone
  );
  return `Hi, reminder for Flat ${row.flatNumber}: ${month} dues (${breakdown}) total ${formatInr(row.totalDue)}. Outstanding ${formatInr(row.outstanding)}. Please pay at your earliest. — Dendukuri's Residences (${businessWhatsApp})`;
}

function reminderMessage(row: MonthlyDuesLedgerRow): string {
  return buildRentReminderMessage(row);
}

/**
 * Unpaid / partial / overdue tenancies for a month (rent + monthly charges + electricity).
 */
export async function listUnpaidRentReminders(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<{
  billingMonthKey: string;
  billingMonthLabel: string;
  rows: UnpaidReminderRow[];
}> {
  const summary = await getMonthlyDuesSummary(supabase, billingMonthKey);
  const unpaid = summary.rows.filter(
    (row) => row.status !== "paid" && row.status !== "waived"
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
      whatsappUrl: toTenantWhatsAppUrl(phone, reminderMessage(row)),
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

export async function sendUnpaidRentWhatsAppReminder(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    billingMonth: string;
    remindedBy: string;
  }
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const tenancyId = input.tenancyId.trim();
  const billingMonth = input.billingMonth.trim();
  if (!tenancyId || !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false, error: "Missing tenancy or billing month." };
  }

  const listed = await listUnpaidRentReminders(supabase, billingMonth);
  const row = listed.rows.find((item) => item.tenancyId === tenancyId);
  if (!row) {
    return { ok: false, error: "Tenancy not found for this month." };
  }
  if (!row.phone) {
    return { ok: false, error: "Tenant has no mobile number on file." };
  }

  const sendResult = await sendWhatsAppBusinessMessage({
    toPhone: row.phone,
    body: buildRentReminderMessage(row),
  });
  if (!sendResult.ok) return sendResult;

  const markResult = await markRentReminded(supabase, {
    tenancyId,
    billingMonth,
    remindedBy: input.remindedBy,
    channel: "whatsapp_api",
    notes: `wa_message_id:${sendResult.messageId}`,
  });
  if (!markResult.ok) return markResult;

  return { ok: true, messageId: sendResult.messageId };
}

export async function sendAllUnpaidWhatsAppReminders(
  supabase: SupabaseClient,
  input: { billingMonth: string; remindedBy: string }
): Promise<{
  ok: true;
  sent: number;
  skipped: number;
  failed: Array<{ tenancyId: string; tenantName: string; error: string }>;
}> {
  const listed = await listUnpaidRentReminders(supabase, input.billingMonth);
  let sent = 0;
  let skipped = 0;
  const failed: Array<{
    tenancyId: string;
    tenantName: string;
    error: string;
  }> = [];

  for (const row of listed.rows) {
    if (!row.phone) {
      skipped += 1;
      continue;
    }
    const result = await sendUnpaidRentWhatsAppReminder(supabase, {
      tenancyId: row.tenancyId,
      billingMonth: listed.billingMonthKey,
      remindedBy: input.remindedBy,
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed.push({
        tenancyId: row.tenancyId,
        tenantName: row.tenantName,
        error: result.error,
      });
    }
  }

  return { ok: true, sent, skipped, failed };
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
      detail: [
        formatExpenseLocation({
          buildingWing: row.buildingWing,
          flatNumber: row.flatNumber,
        }),
        row.vendorName ? `Vendor ${row.vendorName}` : null,
        row.payerAccountLabel ? `Paid by ${row.payerAccountLabel}` : null,
        row.paymentStatus || "pending",
      ]
        .filter(Boolean)
        .join(" · "),
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
): Promise<MonthlyDuesLedgerRow | null> {
  if (!tenancyId) return null;
  const monthKey = billingMonthKey?.trim();
  const summary = await getMonthlyDuesSummary(supabase, monthKey);
  const found = summary.rows.find((row) => row.tenancyId === tenancyId);
  if (found) return found;
  if (!monthKey) return null;
  return getTenancyMonthlyDueRow(supabase, tenancyId, monthKey);
}
