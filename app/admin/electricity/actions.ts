"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createElectricityBillingRun,
  createElectricityReading,
} from "@/lib/electricity";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(formData: FormData, key: string): number | null {
  const raw = asString(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function recordElectricityReading(formData: FormData) {
  const { supabase } = await requireAdmin();

  const result = await createElectricityReading(supabase, {
    flatId: asString(formData, "flat_id"),
    readingDate: asString(formData, "reading_date"),
    previousReading: Number(asString(formData, "previous_reading")),
    currentReading: Number(asString(formData, "current_reading")),
    billAmount: asString(formData, "bill_amount")
      ? Number(asString(formData, "bill_amount"))
      : null,
    status: asString(formData, "status") || "recorded",
    notes: asString(formData, "notes") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/electricity");
    revalidatePath("/tenant");
  }

  return result;
}

export async function generateElectricityBillingAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const flatCount = Number(asString(formData, "flat_count"));
  if (!Number.isFinite(flatCount) || flatCount < 1) {
    return { ok: false as const, error: "No flat readings provided." };
  }

  const flats = [];
  for (let index = 0; index < flatCount; index += 1) {
    const flatId = asString(formData, `flat_id_${index}`);
    if (!flatId) continue;
    flats.push({
      flatId,
      previousReading: Number(asString(formData, `previous_reading_${index}`)),
      currentReading: Number(asString(formData, `current_reading_${index}`)),
      sanctionedKw:
        asOptionalNumber(formData, `sanctioned_kw_${index}`) ?? undefined,
      status: "pending",
    });
  }

  const billingMonthRaw = asString(formData, "billing_month");
  const billingMonth = billingMonthRaw.replace("/", "-");

  const result = await createElectricityBillingRun(supabase, {
    billingMonth,
    readingDate: asString(formData, "reading_date"),
    buildingPreviousReading: Number(
      asString(formData, "building_previous_reading")
    ),
    buildingCurrentReading: Number(
      asString(formData, "building_current_reading")
    ),
    buildingSanctionedKw:
      asOptionalNumber(formData, "building_sanctioned_kw") ?? undefined,
    buildingBillAmount: asOptionalNumber(formData, "building_bill_amount"),
    ratePerUnit: asOptionalNumber(formData, "rate_per_unit") ?? undefined,
    basicChargePerKw:
      asOptionalNumber(formData, "basic_charge_per_kw") ?? undefined,
    serviceChargePercent:
      asOptionalNumber(formData, "service_charge_percent") ?? undefined,
    flats,
  });

  if (!result.ok) return result;

  const totalBilled = result.preview.flats.reduce(
    (sum, row) => sum + row.breakdown.totalDue,
    0
  );

  revalidatePath("/admin/electricity");
  revalidatePath("/tenant");
  revalidatePath("/tenant/electricity");

  return {
    ok: true as const,
    billingRunId: result.billingRunId,
    flatCount: flats.length,
    totalBilled,
  };
}
