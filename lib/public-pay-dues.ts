import type { SupabaseClient } from "@supabase/supabase-js";
import type { DuesBreakdown, DuesBreakdownLine } from "@/lib/dues-breakdown";
import {
  allocatePaymentsAcrossLines,
  computeBreakdownTotals,
  parseDuesBreakdownFromNotes,
} from "@/lib/dues-breakdown";
import { listElectricityReadings } from "@/lib/electricity";
import { getTenantMonthDue } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const monthDue = await getTenantMonthDue(
    supabase,
    input.tenancyId,
    input.billingMonthKey
  );

  if (!monthDue) {
    return { ok: false, error: "No active tenancy dues found for this period." };
  }

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

  const electricityRows = await listElectricityReadings(supabase, {
    flatId: input.flatId,
    limit: 12,
  });
  const electricity = electricityRows.find(
    (row) => row.billingMonth === input.billingMonthKey && num(row.billAmount) > 0
  );

  if (electricity && num(electricity.billAmount) > 0) {
    const bill = num(electricity.billAmount);
    lines.push({
      key: "electricity",
      label: "Electricity",
      due: bill,
      paid: 0,
      outstanding: bill,
    });
  }

  allocatePaymentsAcrossLines(lines, monthDue.amountPaid);

  const { totalDue, totalPaid, totalOutstanding } = computeBreakdownTotals(lines);

  return {
    ok: true,
    breakdown: {
      billingMonthKey: input.billingMonthKey,
      lines,
      totalDue,
      totalPaid,
      totalOutstanding,
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
  return getTenancyDuesBreakdown(admin.client, input);
}

/** Use stored breakdown on payment notes, or compute from tenancy for older receipts. */
export async function resolveReceiptDuesBreakdown(
  supabase: SupabaseClient,
  input: {
    notes: string | null | undefined;
    tenancyId: string | null;
    flatId: string | null;
    billingMonthKey: string | null;
  }
): Promise<DuesBreakdown | null> {
  const stored = parseDuesBreakdownFromNotes(input.notes);
  if (stored) return stored;

  if (!input.tenancyId || !input.flatId || !input.billingMonthKey) {
    return null;
  }

  const computed = await getTenancyDuesBreakdown(supabase, {
    tenancyId: input.tenancyId,
    flatId: input.flatId,
    billingMonthKey: input.billingMonthKey,
  });

  return computed.ok ? computed.breakdown : null;
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
