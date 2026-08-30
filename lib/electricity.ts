import type { SupabaseClient } from "@supabase/supabase-js";
import {
  describeFlatBillingOccupancy,
  tenancyOverlapsBillingMonth,
  type ElectricityBillingOccupancyKind,
} from "@/lib/electricity-occupancy";
import {
  calculateCommonAreaUnits,
  calculateCommonSharePerFlat,
  calculateFlatElectricityBill,
  DEFAULT_ELECTRICITY_BILLING_CONFIG,
  type ElectricityBillingConfig,
  type FlatElectricityBillBreakdown,
} from "@/lib/electricity-billing";
import { buildingWingFromFlatNumber } from "@/lib/building-wing";
import type { FlatLocationOption } from "@/lib/expense-location";

export type FlatOption = FlatLocationOption;

export type ElectricityReading = {
  id: string;
  flatId: string;
  flatNumber: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  units: number;
  commonShareUnits: number | null;
  sanctionedKw: number | null;
  energyCharge: number | null;
  basicCharge: number | null;
  serviceChargeAmount: number | null;
  billAmount: number | null;
  status: string;
  notes: string | null;
  billingMonth: string | null;
};

export type OccupiedFlatForBilling = {
  flatId: string;
  flatNumber: string;
  tenantName: string;
  buildingWing: "C" | "D" | null;
  previousReading: number;
  sanctionedKw: number;
  occupancyKind?: ElectricityBillingOccupancyKind;
  occupancyNote?: string;
};

export type ElectricityBillingRunSummary = {
  id: string;
  billingMonth: string;
  readingDate: string;
  buildingWing: "C" | "D" | null;
  buildingPreviousReading: number;
  buildingCurrentReading: number;
  buildingUnits: number;
  commonAreaUnits: number;
  occupiedFlatsCount: number;
  ratePerUnit: number;
  totalBilled: number;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function currentMonthKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

export async function listFlatsForSelect(
  supabase: SupabaseClient
): Promise<FlatOption[]> {
  const { data } = await supabase
    .from("flats")
    .select("id,flat_number")
    .order("flat_number", { ascending: true });

  return (data ?? []).map((row) => {
    const flatNumber = row.flat_number?.trim() || "?";
    return {
      id: row.id,
      label: `Flat ${flatNumber}`,
      flatNumber,
      building: buildingWingFromFlatNumber(flatNumber),
    };
  });
}

export async function listOccupiedFlatsForBilling(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<OccupiedFlatForBilling[]> {
  return listFlatsForElectricityBilling(
    supabase,
    billingMonthKey?.trim() || currentMonthKey()
  );
}

export async function listFlatsForElectricityBilling(
  supabase: SupabaseClient,
  billingMonthKey: string
): Promise<OccupiedFlatForBilling[]> {
  const { data } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      start_date,
      end_date,
      flats ( id, flat_number ),
      tenants ( full_name )
    `
    );

  type TenancyRow = {
    id: string;
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    flats: { id: string; flat_number: string } | { id: string; flat_number: string }[] | null;
    tenants: { full_name: string } | { full_name: string }[] | null;
  };

  const byFlat = new Map<
    string,
    { flatNumber: string; tenancies: TenancyRow[] }
  >();

  for (const row of (data ?? []) as TenancyRow[]) {
    if (!tenancyOverlapsBillingMonth(row, billingMonthKey)) continue;
    const flat = unwrapOne(row.flats);
    if (!flat?.id) continue;

    const existing = byFlat.get(flat.id);
    if (existing) {
      existing.tenancies.push(row);
      continue;
    }

    byFlat.set(flat.id, {
      flatNumber: flat.flat_number?.trim() || "—",
      tenancies: [row],
    });
  }

  const results: OccupiedFlatForBilling[] = [];
  for (const [flatId, { flatNumber, tenancies }] of byFlat) {
    const occupancy = describeFlatBillingOccupancy(
      tenancies.map((row) => ({
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
        tenantName: unwrapOne(row.tenants)?.full_name?.trim() || "Tenant",
      })),
      billingMonthKey
    );

    const last = await getLastReadingForFlat(supabase, flatId);
    results.push({
      flatId,
      flatNumber,
      tenantName: occupancy.tenantName,
      buildingWing: buildingWingFromFlatNumber(flatNumber),
      previousReading: last?.currentReading ?? 0,
      sanctionedKw: 2,
      occupancyKind: occupancy.occupancyKind,
      occupancyNote: occupancy.occupancyNote || undefined,
    });
  }

  results.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));
  return results;
}

export async function getLastReadingForFlat(
  supabase: SupabaseClient,
  flatId: string
): Promise<{ currentReading: number; readingDate: string } | null> {
  const { data } = await supabase
    .from("electricity_readings")
    .select("current_reading, reading_date")
    .eq("flat_id", flatId)
    .order("reading_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    currentReading: num(data.current_reading),
    readingDate: data.reading_date,
  };
}

export async function getLastReadingsByFlatId(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("electricity_readings")
    .select("flat_id, current_reading, reading_date")
    .order("reading_date", { ascending: false });

  const readings: Record<string, number> = {};
  for (const row of data ?? []) {
    const flatId = row.flat_id as string;
    if (!flatId || flatId in readings) continue;
    readings[flatId] = num(row.current_reading);
  }
  return readings;
}

export async function listElectricityReadings(
  supabase: SupabaseClient,
  options?: { flatId?: string; limit?: number }
): Promise<ElectricityReading[]> {
  let query = supabase
    .from("electricity_readings")
    .select(
      `
      id,
      flat_id,
      reading_date,
      previous_reading,
      current_reading,
      flat_units,
      common_share_units,
      sanctioned_kw,
      energy_charge,
      basic_charge,
      service_charge_amount,
      bill_amount,
      status,
      notes,
      billing_run_id,
      flats ( flat_number ),
      electricity_billing_runs ( billing_month )
    `
    )
    .order("reading_date", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.flatId) {
    query = query.eq("flat_id", options.flatId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => mapReadingRow(row));
}

function mapReadingRow(row: Record<string, unknown>): ElectricityReading {
  const flat = unwrapOne(
    row.flats as { flat_number: string } | { flat_number: string }[] | null
  );
  const run = unwrapOne(
    row.electricity_billing_runs as
      | { billing_month: string }
      | { billing_month: string }[]
      | null
  );
  const previous = num(row.previous_reading);
  const current = num(row.current_reading);
  const flatUnits = row.flat_units == null ? null : num(row.flat_units);
  const units = flatUnits ?? Math.max(current - previous, 0);

  return {
    id: String(row.id),
    flatId: String(row.flat_id),
    flatNumber: flat?.flat_number?.trim() || "—",
    readingDate: String(row.reading_date),
    previousReading: previous,
    currentReading: current,
    units,
    commonShareUnits:
      row.common_share_units == null ? null : num(row.common_share_units),
    sanctionedKw: row.sanctioned_kw == null ? null : num(row.sanctioned_kw),
    energyCharge: row.energy_charge == null ? null : num(row.energy_charge),
    basicCharge: row.basic_charge == null ? null : num(row.basic_charge),
    serviceChargeAmount:
      row.service_charge_amount == null
        ? null
        : num(row.service_charge_amount),
    billAmount: row.bill_amount == null ? null : num(row.bill_amount),
    status: String(row.status ?? "recorded").trim() || "recorded",
    notes: (row.notes as string | null) ?? null,
    billingMonth: run?.billing_month ?? null,
  };
}

export async function listElectricityBillingRuns(
  supabase: SupabaseClient,
  limit = 12
): Promise<ElectricityBillingRunSummary[]> {
  const { data, error } = await supabase
    .from("electricity_billing_runs")
    .select(
      `
      id,
      billing_month,
      reading_date,
      building_previous_reading,
      building_current_reading,
      building_wing,
      common_area_units,
      occupied_flats_count,
      rate_per_unit,
      electricity_readings ( bill_amount )
    `
    )
    .order("reading_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const readings = Array.isArray(row.electricity_readings)
      ? row.electricity_readings
      : row.electricity_readings
        ? [row.electricity_readings]
        : [];
    const totalBilled = readings.reduce(
      (sum, r) => sum + num(r.bill_amount),
      0
    );
    return {
      id: row.id,
      billingMonth: row.billing_month,
      readingDate: row.reading_date,
      buildingWing:
        row.building_wing === "C" || row.building_wing === "D"
          ? row.building_wing
          : null,
      buildingPreviousReading: num(row.building_previous_reading),
      buildingCurrentReading: num(row.building_current_reading),
      buildingUnits: Math.max(
        0,
        num(row.building_current_reading) - num(row.building_previous_reading)
      ),
      commonAreaUnits: num(row.common_area_units),
      occupiedFlatsCount: num(row.occupied_flats_count),
      ratePerUnit: num(row.rate_per_unit),
      totalBilled,
    };
  });
}

export function previewElectricityBills(input: {
  buildingPreviousReading: number;
  buildingCurrentReading: number;
  ratePerUnit?: number;
  basicChargePerKw?: number;
  serviceChargePercent?: number;
  flats: Array<{
    flatId: string;
    previousReading: number;
    currentReading: number;
    sanctionedKw?: number;
  }>;
}): {
  config: ElectricityBillingConfig;
  buildingUnits: number;
  commonAreaUnits: number;
  commonSharePerFlat: number;
  flats: Array<{
    flatId: string;
    flatUnits: number;
    breakdown: FlatElectricityBillBreakdown;
  }>;
} {
  const config: ElectricityBillingConfig = {
    ratePerUnit: input.ratePerUnit ?? DEFAULT_ELECTRICITY_BILLING_CONFIG.ratePerUnit,
    basicChargePerKw:
      input.basicChargePerKw ??
      DEFAULT_ELECTRICITY_BILLING_CONFIG.basicChargePerKw,
    serviceChargePercent:
      input.serviceChargePercent ??
      DEFAULT_ELECTRICITY_BILLING_CONFIG.serviceChargePercent,
    defaultFlatSanctionedKw:
      DEFAULT_ELECTRICITY_BILLING_CONFIG.defaultFlatSanctionedKw,
  };

  const buildingUnits = Math.max(
    0,
    input.buildingCurrentReading - input.buildingPreviousReading
  );

  const flatRows = input.flats.map((flat) => ({
    flatId: flat.flatId,
    flatUnits: Math.max(0, flat.currentReading - flat.previousReading),
    sanctionedKw: flat.sanctionedKw ?? 2,
  }));

  const totalFlatUnits = flatRows.reduce((sum, row) => sum + row.flatUnits, 0);
  const commonAreaUnits = calculateCommonAreaUnits({
    buildingUnits,
    totalFlatUnits,
  });
  const commonSharePerFlat = calculateCommonSharePerFlat({
    commonAreaUnits,
    occupiedFlatsCount: flatRows.length,
  });

  return {
    config,
    buildingUnits,
    commonAreaUnits,
    commonSharePerFlat,
    flats: flatRows.map((row) => ({
      flatId: row.flatId,
      flatUnits: row.flatUnits,
      breakdown: calculateFlatElectricityBill({
        flatUnits: row.flatUnits,
        commonShareUnits: commonSharePerFlat,
        sanctionedKw: row.sanctionedKw,
        config,
      }),
    })),
  };
}

export async function getLastBuildingMeterReading(
  supabase: SupabaseClient,
  buildingWing: "C" | "D"
): Promise<number | null> {
  let query = await supabase
    .from("electricity_billing_runs")
    .select("building_current_reading, reading_date")
    .eq("building_wing", buildingWing)
    .order("reading_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    query.error &&
    /building_wing|does not exist|schema cache/i.test(query.error.message)
  ) {
    query = await supabase
      .from("electricity_billing_runs")
      .select("building_current_reading, reading_date")
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  if (query.error || !query.data) return null;
  return num(query.data.building_current_reading);
}

export async function createElectricityBillingRun(
  supabase: SupabaseClient,
  input: {
    buildingWing: "C" | "D";
    billingMonth?: string;
    readingDate: string;
    buildingPreviousReading: number;
    buildingCurrentReading: number;
    buildingSanctionedKw?: number;
    buildingBillAmount?: number | null;
    ratePerUnit?: number;
    basicChargePerKw?: number;
    serviceChargePercent?: number;
    notes?: string | null;
    flats: Array<{
      flatId: string;
      previousReading: number;
      currentReading: number;
      sanctionedKw?: number;
      status?: string;
    }>;
  }
): Promise<
  | { ok: true; billingRunId: string; preview: ReturnType<typeof previewElectricityBills> }
  | { ok: false; error: string }
> {
  if (!input.readingDate) {
    return { ok: false, error: "Reading date is required." };
  }
  if (input.buildingCurrentReading < input.buildingPreviousReading) {
    return {
      ok: false,
      error: "Building current reading must be ≥ previous reading.",
    };
  }
  if (input.flats.length === 0) {
    return { ok: false, error: "No occupied flats to bill." };
  }

  for (const flat of input.flats) {
    if (flat.currentReading < flat.previousReading) {
      return {
        ok: false,
        error: `Flat reading must be ≥ previous reading.`,
      };
    }
  }

  const preview = previewElectricityBills({
    buildingPreviousReading: input.buildingPreviousReading,
    buildingCurrentReading: input.buildingCurrentReading,
    ratePerUnit: input.ratePerUnit,
    basicChargePerKw: input.basicChargePerKw,
    serviceChargePercent: input.serviceChargePercent,
    flats: input.flats,
  });

  const billingMonth = input.billingMonth?.trim() || currentMonthKey();

  const { data: run, error: runError } = await supabase
    .from("electricity_billing_runs")
    .insert({
      billing_month: billingMonth,
      reading_date: input.readingDate,
      building_wing: input.buildingWing,
      building_previous_reading: input.buildingPreviousReading,
      building_current_reading: input.buildingCurrentReading,
      building_sanctioned_kw: input.buildingSanctionedKw ?? 14,
      building_bill_amount: input.buildingBillAmount ?? null,
      rate_per_unit: preview.config.ratePerUnit,
      basic_charge_per_kw: preview.config.basicChargePerKw,
      service_charge_percent: preview.config.serviceChargePercent,
      occupied_flats_count: input.flats.length,
      common_area_units: preview.commonAreaUnits,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (runError || !run) {
    const runMessage = runError?.message ?? "Could not save billing run.";
    if (
      /electricity_billing_runs|electricity_readings|building_wing|does not exist/i.test(
        runMessage
      )
    ) {
      return {
        ok: false,
        error: `Electricity billing tables are not ready (${runMessage}). Run supabase/migrations/20260830_electricity_billing_repair.sql in Supabase SQL Editor (or run 20260829_electricity_billing.sql then 20260830_electricity_building_wing.sql).`,
      };
    }
    if (/unique|duplicate/i.test(runMessage)) {
      return {
        ok: false,
        error: `A billing run for Building ${input.buildingWing} already exists for this month and reading date.`,
      };
    }
    return { ok: false, error: runMessage };
  }

  const readingRows = input.flats.map((flat) => {
    const calc = preview.flats.find((row) => row.flatId === flat.flatId);
    const breakdown = calc?.breakdown;
    const flatUnits = calc?.flatUnits ?? 0;
    return {
      flat_id: flat.flatId,
      billing_run_id: run.id,
      reading_date: input.readingDate,
      previous_reading: flat.previousReading,
      current_reading: flat.currentReading,
      flat_units: flatUnits,
      common_share_units: preview.commonSharePerFlat,
      sanctioned_kw: flat.sanctionedKw ?? 2,
      energy_charge: breakdown?.energyCharge ?? null,
      basic_charge: breakdown?.basicCharge ?? null,
      service_charge_amount: breakdown?.serviceCharge ?? null,
      bill_amount: breakdown?.totalDue ?? null,
      status: flat.status?.trim() || "pending",
      notes: `billing_month:${billingMonth}`,
    };
  });

  const { error: readingsError } = await supabase
    .from("electricity_readings")
    .insert(readingRows);

  if (readingsError) {
    await supabase.from("electricity_billing_runs").delete().eq("id", run.id);
    return { ok: false, error: readingsError.message };
  }

  return { ok: true, billingRunId: run.id, preview };
}

export async function createElectricityReading(
  supabase: SupabaseClient,
  input: {
    flatId: string;
    readingDate: string;
    previousReading: number;
    currentReading: number;
    billAmount?: number | null;
    status?: string;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.flatId) return { ok: false, error: "Select a flat." };
  if (!input.readingDate) return { ok: false, error: "Reading date is required." };
  if (input.currentReading < input.previousReading) {
    return { ok: false, error: "Current reading must be ≥ previous reading." };
  }

  const { data, error } = await supabase
    .from("electricity_readings")
    .insert({
      flat_id: input.flatId,
      reading_date: input.readingDate,
      previous_reading: input.previousReading,
      current_reading: input.currentReading,
      flat_units: Math.max(0, input.currentReading - input.previousReading),
      bill_amount: input.billAmount ?? null,
      status: input.status?.trim() || "recorded",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save reading." };
  }

  return { ok: true, id: data.id };
}
