import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArrearsMonthBreakdown,
  DuesBreakdown,
  DuesBreakdownLine,
  DuesCategoryBreakdown,
} from "@/lib/dues-breakdown";
import {
  allocatePaymentsAcrossLines,
  applyAdditionalPaymentToBreakdown,
  categoryTotalsFromBreakdown,
  computeBreakdownTotals,
  parseDuesBreakdownFromNotes,
  resetBreakdownForAllocation,
} from "@/lib/dues-breakdown";
import { getTenantMonthDue } from "@/lib/reminders";
import { formatBillingMonthLabel } from "@/lib/receipts";
import { firstMonthlyBillingMonthKey } from "@/lib/rent-billing-month";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MonthlyDuesLedgerRow } from "@/lib/monthly-dues";

function priorBillingMonthKeys(upToMonthKey: string, count = 1): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(upToMonthKey);
  if (!match) return [];
  let year = Number(match[1]);
  let month = Number(match[2]);
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return keys;
}

function buildLinesFromMonthDue(monthDue: MonthlyDuesLedgerRow): DuesBreakdownLine[] {
  const lines: DuesBreakdownLine[] = [];

  if (monthDue.rentDue > 0) {
    lines.push({
      key: "rent",
      label: "Rent",
      due: monthDue.rentDue,
      paid: 0,
      outstanding: monthDue.rentDue,
    });
  }
  if (monthDue.maintenanceCharge > 0) {
    lines.push({
      key: "maintenance",
      label: "Maintenance",
      due: monthDue.maintenanceCharge,
      paid: 0,
      outstanding: monthDue.maintenanceCharge,
    });
  }
  if (monthDue.carParkingCharge > 0) {
    lines.push({
      key: "parking",
      label: "Car parking",
      due: monthDue.carParkingCharge,
      paid: 0,
      outstanding: monthDue.carParkingCharge,
    });
  }
  if (monthDue.washingMachineCharge > 0) {
    lines.push({
      key: "washer",
      label: "Washing machine",
      due: monthDue.washingMachineCharge,
      paid: 0,
      outstanding: monthDue.washingMachineCharge,
    });
  }
  if (monthDue.otherMonthlyCharge > 0) {
    lines.push({
      key: "other",
      label: monthDue.otherChargesNotes?.trim() || "Other monthly",
      due: monthDue.otherMonthlyCharge,
      paid: 0,
      outstanding: monthDue.otherMonthlyCharge,
    });
  }
  if (monthDue.electricityCharge > 0) {
    lines.push({
      key: "electricity",
      label: "Electricity",
      due: monthDue.electricityCharge,
      paid: 0,
      outstanding: monthDue.electricityCharge,
    });
  }

  allocatePaymentsAcrossLines(lines, monthDue.amountPaid);
  return lines;
}

function buildBreakdownFromMonthDue(
  monthDue: MonthlyDuesLedgerRow,
  billingMonthKey: string,
  infoMessage?: string
): DuesBreakdown {
  const lines = buildLinesFromMonthDue(monthDue);
  const { totalDue, totalPaid, totalOutstanding } = computeBreakdownTotals(lines);
  return {
    billingMonthKey,
    lines,
    totalDue,
    totalPaid,
    totalOutstanding,
    infoMessage,
  };
}

async function loadMonthDueForTenancy(
  supabase: SupabaseClient,
  tenancyId: string,
  billingMonthKey: string
): Promise<MonthlyDuesLedgerRow | null> {
  return getTenantMonthDue(supabase, tenancyId, billingMonthKey);
}

export async function verifyPublicPayTenantPhone(
  supabase: SupabaseClient,
  flatNumber: string,
  payerPhone: string
): Promise<
  | { ok: true; tenancyId: string; flatId: string; tenantName: string | null }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc("verify_public_pay_tenant_phone", {
    p_flat_number: flatNumber.trim(),
    p_payer_phone: payerPhone.trim(),
  });

  if (error) {
    const msg = error.message ?? "";
    if (/verify_public_pay_tenant_phone|could not find|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Phone verification is not set up yet. Run supabase/migrations/20260830_public_pay_phone_verify.sql in Supabase.",
      };
    }
    return { ok: false, error: msg || "Could not verify mobile number." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.tenancy_id || !row?.flat_id) {
    return {
      ok: false,
      error:
        "Mobile number does not match the registered tenant for this flat. Use the number on your tenancy record.",
    };
  }

  return {
    ok: true,
    tenancyId: String(row.tenancy_id),
    flatId: String(row.flat_id),
    tenantName: row.tenant_name ? String(row.tenant_name) : null,
  };
}

export async function getTenancyDuesBreakdown(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    flatId: string;
    billingMonthKey: string;
  }
): Promise<{ ok: true; breakdown: DuesBreakdown } | { ok: false; error: string }> {
  const monthDue = await loadMonthDueForTenancy(
    supabase,
    input.tenancyId,
    input.billingMonthKey
  );

  if (!monthDue) {
    return { ok: false, error: "No tenancy dues found for this period." };
  }

  let infoMessage: string | undefined;
  if (
    monthDue.totalDue === 0 &&
    monthDue.outstanding === 0 &&
    monthDue.startDate
  ) {
    const firstDue = firstMonthlyBillingMonthKey(monthDue.startDate);
    if (
      firstDue &&
      input.billingMonthKey < firstDue
    ) {
      infoMessage = `No dues for this month. First rent is due ${formatBillingMonthLabel(firstDue)}.`;
    }
  }

  return {
    ok: true,
    breakdown: buildBreakdownFromMonthDue(
      monthDue,
      input.billingMonthKey,
      infoMessage
    ),
  };
}

/** Current month breakdown plus outstanding from the prior billing month only. */
export async function getTenancyDuesBreakdownWithArrears(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    flatId: string;
    billingMonthKey: string;
  }
): Promise<{ ok: true; breakdown: DuesBreakdown } | { ok: false; error: string }> {
  const current = await getTenancyDuesBreakdown(supabase, input);
  if (!current.ok) return current;

  const arrears: ArrearsMonthBreakdown[] = [];
  for (const monthKey of priorBillingMonthKeys(input.billingMonthKey, 1)) {
    const monthDue = await loadMonthDueForTenancy(
      supabase,
      input.tenancyId,
      monthKey
    );
    if (!monthDue || monthDue.outstanding <= 0) continue;

    const lines = buildLinesFromMonthDue(monthDue).filter(
      (line) => line.outstanding > 0
    );
    if (lines.length === 0) continue;

    arrears.push({
      billingMonthKey: monthKey,
      billingMonthLabel: formatBillingMonthLabel(monthKey),
      lines: lines.map((line) => ({
        ...line,
        isArrears: true,
        arrearsMonthKey: monthKey,
        label: `${line.label} (${formatBillingMonthLabel(monthKey)})`,
      })),
      totalOutstanding: lines.reduce((sum, line) => sum + line.outstanding, 0),
    });
  }

  const arrearsTotal = arrears.reduce(
    (sum, month) => sum + month.totalOutstanding,
    0
  );
  const priorMonth = arrears[0];

  return {
    ok: true,
    breakdown: {
      ...current.breakdown,
      arrears,
      grandTotalOutstanding: current.breakdown.totalOutstanding + arrearsTotal,
      priorMonthLabel: priorMonth?.billingMonthLabel,
      priorMonthArrearsTotal: arrearsTotal > 0 ? arrearsTotal : undefined,
    },
  };
}

export async function getPublicPayDuesBreakdown(input: {
  tenancyId: string;
  flatId: string;
  billingMonthKey: string;
}): Promise<{ ok: true; breakdown: DuesBreakdown } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin.ok) return { ok: false, error: admin.error };
  return getTenancyDuesBreakdownWithArrears(admin.client, input);
}

/** Recompute breakdown from ledger + bills; fall back to stored notes if needed. */
export async function resolveReceiptDuesBreakdown(
  supabase: SupabaseClient,
  input: {
    notes: string | null | undefined;
    tenancyId: string | null;
    flatId: string | null;
    billingMonthKey: string | null;
  }
): Promise<DuesBreakdown | null> {
  if (input.tenancyId && input.flatId && input.billingMonthKey) {
    const computed = await getTenancyDuesBreakdown(supabase, {
      tenancyId: input.tenancyId,
      flatId: input.flatId,
      billingMonthKey: input.billingMonthKey,
    });
    if (computed.ok) return computed.breakdown;
  }

  return parseDuesBreakdownFromNotes(input.notes);
}

export function parseDuesBreakdownJson(raw: string): DuesBreakdown | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as DuesBreakdown;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Split collected dues into rent / electricity / other by re-applying payments
 * against the live dues structure (includes electricity billing for the month).
 */
export async function computeCollectedCategoryBreakdownForTenancy(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    flatId: string;
    billingMonthKey: string;
    payments: Array<{ amount: number; paymentDate: string }>;
  }
): Promise<DuesCategoryBreakdown> {
  const sorted = [...input.payments].sort((a, b) =>
    a.paymentDate.localeCompare(b.paymentDate)
  );
  const totalPaid = sorted.reduce((sum, payment) => sum + payment.amount, 0);
  if (totalPaid <= 0) {
    return { rent: 0, electricity: 0, other: 0 };
  }

  const dues = await getTenancyDuesBreakdownWithArrears(supabase, {
    tenancyId: input.tenancyId,
    flatId: input.flatId,
    billingMonthKey: input.billingMonthKey,
  });

  if (!dues.ok) {
    return { rent: totalPaid, electricity: 0, other: 0 };
  }

  let breakdown = resetBreakdownForAllocation(dues.breakdown);
  for (const payment of sorted) {
    breakdown = applyAdditionalPaymentToBreakdown(breakdown, payment.amount);
  }

  return categoryTotalsFromBreakdown(breakdown);
}
