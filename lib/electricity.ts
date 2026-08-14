import type { SupabaseClient } from "@supabase/supabase-js";

export type FlatOption = { id: string; label: string };

export type ElectricityReading = {
  id: string;
  flatId: string;
  flatNumber: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  units: number;
  billAmount: number | null;
  status: string;
  notes: string | null;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listFlatsForSelect(
  supabase: SupabaseClient
): Promise<FlatOption[]> {
  const { data } = await supabase
    .from("flats")
    .select("id,flat_number")
    .order("flat_number", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    label: `Flat ${row.flat_number ?? "?"}`,
  }));
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
      bill_amount,
      status,
      notes,
      flats ( flat_number )
    `
    )
    .order("reading_date", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.flatId) {
    query = query.eq("flat_id", options.flatId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const flat = Array.isArray(row.flats) ? row.flats[0] : row.flats;
    const previous = num(row.previous_reading);
    const current = num(row.current_reading);
    const bill =
      row.bill_amount == null ? null : num(row.bill_amount);

    return {
      id: row.id,
      flatId: row.flat_id,
      flatNumber: flat?.flat_number?.trim() || "—",
      readingDate: row.reading_date,
      previousReading: previous,
      currentReading: current,
      units: Math.max(current - previous, 0),
      billAmount: bill,
      status: row.status?.trim() || "recorded",
      notes: row.notes,
    };
  });
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
