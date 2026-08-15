import { readFileSync } from "fs";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDendukuriProperty, PROPERTY_NAME } from "@/lib/property";

export type ImportSummary = {
  propertyId: string | null;
  flatsCreated: number;
  flatsSkipped: number;
  tenantsCreated: number;
  tenantsSkipped: number;
  tenanciesCreated: number;
  tenanciesSkipped: number;
  reviewFlags: string[];
  errors: string[];
};

type CsvRow = {
  flatNo: string;
  tenantName: string | null;
  phone: string | null;
  flatTypeRaw: string | null;
  rentAgreed: number | null;
  maintenanceAgreed: number | null;
  advanceAgreed: number | null;
  advancePaid: number | null;
  paidTo: string | null;
  advancePaidDateRaw: string | null;
  carPark: string | null;
  movedInRaw: string | null;
};

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  return trimmed;
}

function parseMoney(value: string | null | undefined): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const n = Number(raw.replace(/[,₹]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeFlatType(value: string | null): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact === "1BHK" || compact === "2BHK") return compact;
  return null;
}

/** Letter + 3 digits → floor = hundreds digit (001→0 … 301→3). */
export function floorFromFlatNumber(
  flatNo: string
): { floor: number } | { error: string } {
  const match = flatNo.trim().match(/^([A-Za-z])(\d{3})$/);
  if (!match) return { error: `Flat ${flatNo}: pattern mismatch for floor` };
  const floor = Math.floor(Number(match[2]) / 100);
  if (floor < 0 || floor > 3) {
    return { error: `Flat ${flatNo}: floor ${floor} out of range` };
  }
  return { floor };
}

/**
 * Mixed sheet dates:
 * - first > 12 → DD/MM
 * - second > 12 → MM/DD
 * - both ≤ 12 → MM/DD (sheet convention for unambiguous US-style dates)
 */
export function parseSheetDate(token: string): string | null {
  const m = token.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = Number(m[3]);
  let day: number;
  let month: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    month = a;
    day = b;
  } else {
    month = a;
    day = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(y, month - 1, day));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

export function extractDateTokens(raw: string | null): string[] {
  if (!raw) return [];
  return raw.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? [];
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length < 2) return [];

  // Minimal CSV parse supporting quoted newlines in fields.
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };
  const pushRecord = () => {
    if (current.length > 1 || current.some((c) => c.trim())) {
      records.push(current);
    }
    current = [];
  };

  const text = lines.join("\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRecord();
      continue;
    }
    field += ch;
  }
  pushField();
  pushRecord();

  const header = records[0]?.map((h) => h.trim()) ?? [];
  const idx = (name: string) => header.indexOf(name);

  return records.slice(1).map((cols) => {
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? cols[i] ?? "" : "";
    };
    return {
      flatNo: clean(get("Flat No")) ?? "",
      tenantName: clean(get("Tenant Name")),
      phone: clean(get("Phone")),
      flatTypeRaw: clean(get("Flat Type")),
      rentAgreed: parseMoney(get("Rent Agreed")),
      maintenanceAgreed: parseMoney(get("Maintenance Agreed")),
      advanceAgreed: parseMoney(get("Advance Agreed")),
      advancePaid: parseMoney(get("Advance Paid")),
      paidTo: clean(get("Paid to")),
      advancePaidDateRaw: clean(get("Advance Paid Date")),
      carPark: clean(get("Car park 1000/- extra")),
      movedInRaw: clean(get("Moved in Date")),
    };
  }).filter((r) => r.flatNo);
}

export function loadRentalTrackingCsv(
  cwd = process.cwd()
): CsvRow[] {
  const path = join(cwd, "data", "rental-tracking.csv");
  const content = readFileSync(path, "utf8");
  return parseCsv(content);
}

function buildTenancyNotes(row: CsvRow, flags: string[]): string | null {
  const parts: string[] = [];
  if (row.rentAgreed == null && row.tenantName) {
    parts.push("Rent not specified in source sheet.");
  }
  if (row.paidTo) parts.push(`Paid to: ${row.paidTo}`);

  const advanceTokens = extractDateTokens(row.advancePaidDateRaw);
  if (advanceTokens.length > 1) {
    parts.push(
      `Advance part-payments: ${advanceTokens.join(" + ")} (raw: ${row.advancePaidDateRaw})`
    );
  } else if (row.advancePaidDateRaw && advanceTokens.length === 0) {
    parts.push(`Advance Paid Date (raw): ${row.advancePaidDateRaw}`);
  }

  const movedTokens = extractDateTokens(row.movedInRaw);
  if (row.movedInRaw && movedTokens.length === 0) {
    parts.push(`Moved in Date (raw): ${row.movedInRaw}`);
  }

  if (flags.length) parts.push(`Review: ${flags.join("; ")}`);
  return parts.length ? parts.join("\n") : null;
}

function buildFlatNotes(row: CsvRow): string | null {
  const parts: string[] = [];
  if (row.carPark != null) parts.push(`car_park:${row.carPark}`);
  if (!row.tenantName && row.movedInRaw) {
    parts.push(`Moved in Date (raw, vacant): ${row.movedInRaw}`);
  }
  return parts.length ? parts.join("\n") : null;
}

/**
 * Idempotent import from data/rental-tracking.csv.
 * Does not create rent payments/receipts for advances.
 * Does not overwrite existing flats/tenants/active tenancies.
 */
export async function importRentalTrackingCsv(
  supabase: SupabaseClient
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    propertyId: null,
    flatsCreated: 0,
    flatsSkipped: 0,
    tenantsCreated: 0,
    tenantsSkipped: 0,
    tenanciesCreated: 0,
    tenanciesSkipped: 0,
    reviewFlags: [],
    errors: [],
  };

  const property = await ensureDendukuriProperty(supabase);
  if (property.mode !== "properties" || !property.id) {
    summary.errors.push(
      "properties table missing or not writable. Run migration 20260815_phase9_property_and_flat_fields.sql first."
    );
    return summary;
  }
  summary.propertyId = property.id;

  const rows = loadRentalTrackingCsv();

  for (const row of rows) {
    const flags: string[] = [];
    const floorResult = floorFromFlatNumber(row.flatNo);
    if ("error" in floorResult) {
      flags.push(floorResult.error);
      summary.reviewFlags.push(floorResult.error);
    }
    const flatType = normalizeFlatType(row.flatTypeRaw);
    if (!flatType) {
      flags.push(`${row.flatNo}: unrecognized flat type ${row.flatTypeRaw}`);
      summary.reviewFlags.push(`${row.flatNo}: flat type`);
    }

    const advanceTokens = extractDateTokens(row.advancePaidDateRaw);
    const advanceDates = advanceTokens
      .map(parseSheetDate)
      .filter((d): d is string => Boolean(d));
    const depositPaidDate =
      advanceDates.length > 0
        ? advanceDates.reduce((a, b) => (a > b ? a : b))
        : null;
    if (advanceTokens.length > 1) {
      flags.push(`${row.flatNo}: advance part-payments`);
      summary.reviewFlags.push(
        `${row.flatNo}: part-payment deposit dates → latest ${depositPaidDate ?? "n/a"}`
      );
    }

    const movedTokens = extractDateTokens(row.movedInRaw);
    const startDate =
      movedTokens.length === 1 ? parseSheetDate(movedTokens[0]) : null;
    if (row.phone && row.phone.includes("\n")) {
      flags.push(`${row.flatNo}: multiple phones`);
      summary.reviewFlags.push(`${row.flatNo}: multiple phones kept as-is`);
    }
    if (row.tenantName && /maintainence/i.test(row.tenantName)) {
      summary.reviewFlags.push(`${row.flatNo}: tenant name has Maintainence tag`);
    }

    // --- flat ---
    const { data: existingFlat } = await supabase
      .from("flats")
      .select("id,status")
      .eq("flat_number", row.flatNo)
      .maybeSingle();

    let flatId = existingFlat?.id as string | undefined;
    if (flatId) {
      summary.flatsSkipped += 1;
    } else {
      const occupied = Boolean(row.tenantName);
      const payload: Record<string, unknown> = {
        flat_number: row.flatNo,
        flat_type: flatType,
        status: occupied ? "occupied" : "vacant",
        property_id: property.id,
        building: PROPERTY_NAME,
        notes: buildFlatNotes(row),
        maintenance_amount: row.maintenanceAgreed,
      };
      if ("floor" in floorResult) payload.floor = floorResult.floor;

      const { data: createdFlat, error: flatError } = await supabase
        .from("flats")
        .insert(payload)
        .select("id")
        .single();

      if (flatError || !createdFlat) {
        summary.errors.push(
          `${row.flatNo}: flat insert failed — ${flatError?.message ?? "unknown"}`
        );
        continue;
      }
      flatId = createdFlat.id;
      summary.flatsCreated += 1;
    }

    if (!row.tenantName || !flatId) continue;

    // --- tenant ---
    let tenantQuery = supabase
      .from("tenants")
      .select("id")
      .eq("full_name", row.tenantName);
    if (row.phone) tenantQuery = tenantQuery.eq("phone", row.phone);
    const { data: existingTenants } = await tenantQuery.limit(1);
    let tenantId = existingTenants?.[0]?.id as string | undefined;

    if (tenantId) {
      summary.tenantsSkipped += 1;
    } else {
      const { data: createdTenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          full_name: row.tenantName,
          phone: row.phone,
          notes: flags.length ? `Import review: ${flags.join("; ")}` : null,
        })
        .select("id")
        .single();

      if (tenantError || !createdTenant) {
        summary.errors.push(
          `${row.flatNo}: tenant insert failed — ${tenantError?.message ?? "unknown"}`
        );
        continue;
      }
      tenantId = createdTenant.id;
      summary.tenantsCreated += 1;
    }

    // --- tenancy ---
    const { data: existingTenancies } = await supabase
      .from("tenancies")
      .select("id,status")
      .eq("flat_id", flatId);

    const hasActive = (existingTenancies ?? []).some((t) => {
      const s = (t.status ?? "").toLowerCase();
      return s === "active" || s === "occupied" || s === "";
    });

    if (hasActive) {
      summary.tenanciesSkipped += 1;
      continue;
    }

    const depositAmount = row.advanceAgreed;
    const notes = buildTenancyNotes(row, flags);

    const { error: tenancyError } = await supabase.from("tenancies").insert({
      flat_id: flatId,
      tenant_id: tenantId,
      status: "active",
      monthly_rent: row.rentAgreed,
      security_deposit: depositAmount,
      deposit_amount: depositAmount,
      deposit_paid: row.advancePaid,
      deposit_paid_date: depositPaidDate,
      start_date: startDate,
      notes,
    });

    if (tenancyError) {
      summary.errors.push(
        `${row.flatNo}: tenancy insert failed — ${tenancyError.message}`
      );
      continue;
    }
    summary.tenanciesCreated += 1;

    await supabase
      .from("flats")
      .update({ status: "occupied", property_id: property.id })
      .eq("id", flatId);
  }

  return summary;
}
