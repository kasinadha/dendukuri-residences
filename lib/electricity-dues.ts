import type { SupabaseClient } from "@supabase/supabase-js";
import type { ElectricityReading } from "@/lib/electricity";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { getTenancyDuesBreakdown } from "@/lib/public-pay-dues";

export type ElectricityPaymentStatus = {
  billingMonthKey: string;
  due: number;
  paid: number;
  outstanding: number;
  label: "Paid" | "Partial" | "Unpaid";
};

export function parseBillingMonthFromReadingNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  const match = notes.match(/billing_month:(\d{4}-\d{2})/i);
  return match?.[1] ?? null;
}

export function readingBillingMonthKey(
  reading: Pick<ElectricityReading, "billingMonth" | "notes">
): string | null {
  return (
    reading.billingMonth?.trim() ||
    parseBillingMonthFromReadingNotes(reading.notes) ||
    null
  );
}

export async function getElectricityPaymentStatus(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    flatId: string;
    billingMonthKey: string;
  }
): Promise<ElectricityPaymentStatus | null> {
  const result = await getTenancyDuesBreakdown(supabase, input);
  if (!result.ok) return null;

  const line = result.breakdown.lines.find((item) => item.key === "electricity");
  if (!line || line.due <= 0) return null;

  const label: ElectricityPaymentStatus["label"] =
    line.outstanding <= 0 ? "Paid" : line.paid > 0 ? "Partial" : "Unpaid";

  return {
    billingMonthKey: input.billingMonthKey,
    due: line.due,
    paid: line.paid,
    outstanding: line.outstanding,
    label,
  };
}

export async function getElectricityPaymentStatusByFlat(
  supabase: SupabaseClient,
  input: {
    flatNumber: string;
    billingMonthKey: string;
    tenancyByFlat: Map<string, { tenancyId: string; flatId: string }>;
  }
): Promise<ElectricityPaymentStatus | null> {
  const tenancy = input.tenancyByFlat.get(input.flatNumber);
  if (!tenancy) return null;
  return getElectricityPaymentStatus(supabase, {
    tenancyId: tenancy.tenancyId,
    flatId: tenancy.flatId,
    billingMonthKey: input.billingMonthKey,
  });
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function buildTenancyByFlatNumberMap(
  supabase: SupabaseClient
): Promise<Map<string, { tenancyId: string; flatId: string }>> {
  const { data } = await supabase
    .from("tenancies")
    .select("id, flat_id, status, flats ( flat_number )");

  const map = new Map<string, { tenancyId: string; flatId: string }>();
  for (const row of data ?? []) {
    if (!isActiveTenancyStatus(String(row.status ?? ""))) continue;
    const flat = unwrapOne(
      row.flats as { flat_number: string } | { flat_number: string }[] | null
    );
    const flatNumber = flat?.flat_number?.trim();
    if (!flatNumber) continue;
    map.set(flatNumber, {
      tenancyId: String(row.id),
      flatId: String(row.flat_id),
    });
  }
  return map;
}

export async function enrichElectricityReadingsWithPaymentStatus(
  supabase: SupabaseClient,
  readings: ElectricityReading[],
  input: { tenancyId: string; flatId: string }
): Promise<
  Array<ElectricityReading & { paymentStatus: ElectricityPaymentStatus | null }>
> {
  const cache = new Map<string, ElectricityPaymentStatus | null>();
  const enriched: Array<
    ElectricityReading & { paymentStatus: ElectricityPaymentStatus | null }
  > = [];

  for (const reading of readings) {
    const billingMonthKey = readingBillingMonthKey(reading);
    if (!billingMonthKey) {
      enriched.push({ ...reading, paymentStatus: null });
      continue;
    }
    if (!cache.has(billingMonthKey)) {
      cache.set(
        billingMonthKey,
        await getElectricityPaymentStatus(supabase, {
          tenancyId: input.tenancyId,
          flatId: input.flatId,
          billingMonthKey,
        })
      );
    }
    enriched.push({
      ...reading,
      paymentStatus: cache.get(billingMonthKey) ?? null,
    });
  }

  return enriched;
}
