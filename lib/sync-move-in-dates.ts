import { readFileSync } from "fs";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSheetDate } from "@/lib/import-rental-csv";
import { isActiveTenancyStatus } from "@/lib/occupancy";

export type SyncMoveInDatesSummary = {
  flatsInCsv: number;
  updated: number;
  unchanged: number;
  skippedNoTenancy: string[];
  skippedNoDate: string[];
  errors: string[];
};

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  return trimmed;
}

/** First non-empty move-in date per flat from rental-payment-tracking.csv. */
export function loadMoveInDatesFromPaymentCsv(
  cwd = process.cwd()
): Map<string, string> {
  const path = join(cwd, "data", "rental-payment-tracking.csv");
  const content = readFileSync(path, "utf8");
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length < 2) return new Map();

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const flatIdx = header.indexOf("flat number");
  const moveInIdx = header.findIndex(
    (h) => h === "move in date" || h === "moved in date"
  );
  if (flatIdx < 0 || moveInIdx < 0) return new Map();

  const byFlat = new Map<string, string>();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const flatNo = clean(cols[flatIdx])?.toUpperCase();
    if (!flatNo) continue;
    const raw = clean(cols[moveInIdx]);
    if (!raw) continue;
    if (byFlat.has(flatNo)) continue;
    const iso = parseSheetDate(raw);
    if (iso) byFlat.set(flatNo, iso);
  }
  return byFlat;
}

export async function syncMoveInDatesFromPaymentCsv(
  supabase: SupabaseClient
): Promise<SyncMoveInDatesSummary> {
  const summary: SyncMoveInDatesSummary = {
    flatsInCsv: 0,
    updated: 0,
    unchanged: 0,
    skippedNoTenancy: [],
    skippedNoDate: [],
    errors: [],
  };

  let moveInByFlat: Map<string, string>;
  try {
    moveInByFlat = loadMoveInDatesFromPaymentCsv();
  } catch (error) {
    summary.errors.push(
      error instanceof Error ? error.message : "Could not read payment CSV."
    );
    return summary;
  }

  summary.flatsInCsv = moveInByFlat.size;

  const { data: flats, error: flatsError } = await supabase
    .from("flats")
    .select("id, flat_number");

  if (flatsError || !flats) {
    summary.errors.push(flatsError?.message ?? "Could not load flats.");
    return summary;
  }

  const flatIdByNumber = new Map<string, string>();
  for (const flat of flats) {
    const key = flat.flat_number?.trim().toUpperCase();
    if (key) flatIdByNumber.set(key, flat.id);
  }

  const { data: tenancies, error: tenanciesError } = await supabase
    .from("tenancies")
    .select("id, flat_id, status, start_date");

  if (tenanciesError || !tenancies) {
    summary.errors.push(tenanciesError?.message ?? "Could not load tenancies.");
    return summary;
  }

  const activeByFlatId = new Map<
    string,
    { id: string; start_date: string | null }
  >();
  for (const row of tenancies) {
    if (!isActiveTenancyStatus(row.status)) continue;
    const flatId = row.flat_id as string;
    if (!flatId) continue;
    activeByFlatId.set(flatId, {
      id: row.id as string,
      start_date: (row.start_date as string | null) ?? null,
    });
  }

  for (const [flatNo, moveInDate] of moveInByFlat) {
    const flatId = flatIdByNumber.get(flatNo);
    if (!flatId) {
      summary.skippedNoTenancy.push(`${flatNo} (flat not found)`);
      continue;
    }

    const tenancy = activeByFlatId.get(flatId);
    if (!tenancy) {
      summary.skippedNoTenancy.push(flatNo);
      continue;
    }

    if (tenancy.start_date === moveInDate) {
      summary.unchanged += 1;
      continue;
    }

    const { error } = await supabase
      .from("tenancies")
      .update({ start_date: moveInDate })
      .eq("id", tenancy.id);

    if (error) {
      summary.errors.push(`${flatNo}: ${error.message}`);
      continue;
    }
    summary.updated += 1;
  }

  for (const flat of flats) {
    const key = flat.flat_number?.trim().toUpperCase();
    if (!key || moveInByFlat.has(key)) continue;
    const tenancy = activeByFlatId.get(flat.id);
    if (tenancy && !tenancy.start_date) {
      summary.skippedNoDate.push(key);
    }
  }

  return summary;
}
