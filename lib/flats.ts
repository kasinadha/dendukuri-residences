import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contributesToRentExpected,
  isActiveTenancyStatus,
  isOccupiedFlatStatus,
  occupancyLabel,
  type OccupancyKind,
} from "@/lib/occupancy";
import { PROPERTY_NAME, type PropertyRecord } from "@/lib/property";
import { parseSourceFromNotes } from "@/lib/tenancies";

export type FlatListItem = {
  id: string;
  flatNumber: string;
  type: string;
  floor: string | null;
  status: string;
  occupancy: OccupancyKind;
  rent: number | null;
  deposit: number | null;
  maintenanceAmount: number | null;
  notes: string | null;
  source: string | null;
  tenantName: string | null;
  isOccupied: boolean;
  propertyName: string;
  upiId: string | null;
  upiQrUrl: string | null;
};

export type FlatWriteInput = {
  flatNumber: string;
  flatType: string;
  floor?: string | null;
  status: string;
  monthlyRent?: number | null;
  deposit?: number | null;
  maintenanceAmount?: number | null;
  notes?: string | null;
  upiId?: string | null;
  upiQrUrl?: string | null;
  property?: PropertyRecord | null;
};

export type FlatWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type FlatSchemaMode = {
  hasPropertyId: boolean;
  hasFloor: boolean;
  hasMonthlyRent: boolean;
  hasDeposit: boolean;
  hasMaintenance: boolean;
  hasUpiId: boolean;
  hasUpiQrUrl: boolean;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "")
  );
}

/** Parse structured meta keys from flats.notes (legacy / pre-migration). */
export function parseFlatMetaFromNotes(notes: string | null | undefined): {
  floor: string | null;
  monthlyRent: number | null;
  deposit: number | null;
  maintenanceAmount: number | null;
  source: string | null;
  freeNotes: string | null;
} {
  if (!notes) {
    return {
      floor: null,
      monthlyRent: null,
      deposit: null,
      maintenanceAmount: null,
      source: null,
      freeNotes: null,
    };
  }

  const lines = notes.split(/\r?\n/);
  const meta: Record<string, string> = {};
  const free: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\s*(floor|monthly_rent|deposit|maintenance|source)\s*:\s*(.*?)\s*$/i
    );
    if (match) {
      meta[match[1].toLowerCase()] = match[2];
    } else if (line.trim()) {
      free.push(line);
    }
  }

  return {
    floor: meta.floor?.trim() || null,
    monthlyRent: num(meta.monthly_rent),
    deposit: num(meta.deposit),
    maintenanceAmount: num(meta.maintenance),
    source: meta.source?.trim() || parseSourceFromNotes(notes),
    freeNotes: free.length ? free.join("\n") : null,
  };
}

export function encodeFlatNotes(input: {
  floor?: string | null;
  monthlyRent?: number | null;
  deposit?: number | null;
  maintenanceAmount?: number | null;
  source?: string | null;
  freeNotes?: string | null;
  /** When columns exist, only free notes (+ optional source) need encoding. */
  encodeFinancialMeta?: boolean;
}): string | null {
  const parts: string[] = [];
  const encodeMeta = input.encodeFinancialMeta !== false;

  if (encodeMeta) {
    if (input.floor?.trim()) parts.push(`floor:${input.floor.trim()}`);
    if (input.monthlyRent != null && Number.isFinite(input.monthlyRent)) {
      parts.push(`monthly_rent:${input.monthlyRent}`);
    }
    if (input.deposit != null && Number.isFinite(input.deposit)) {
      parts.push(`deposit:${input.deposit}`);
    }
    if (
      input.maintenanceAmount != null &&
      Number.isFinite(input.maintenanceAmount)
    ) {
      parts.push(`maintenance:${input.maintenanceAmount}`);
    }
  }

  if (input.source?.trim()) parts.push(`source:${input.source.trim()}`);
  if (input.freeNotes?.trim()) parts.push(input.freeNotes.trim());

  return parts.length ? parts.join("\n") : null;
}

let cachedSchema: FlatSchemaMode | null = null;

export async function detectFlatSchema(
  supabase: SupabaseClient
): Promise<FlatSchemaMode> {
  if (cachedSchema) return cachedSchema;

  const probes: Array<keyof FlatSchemaMode> = [
    "hasPropertyId",
    "hasFloor",
    "hasMonthlyRent",
    "hasDeposit",
    "hasMaintenance",
    "hasUpiId",
    "hasUpiQrUrl",
  ];
  const columns = [
    "property_id",
    "floor",
    "monthly_rent",
    "deposit",
    "maintenance_amount",
    "upi_id",
    "upi_qr_url",
  ] as const;

  const mode: FlatSchemaMode = {
    hasPropertyId: false,
    hasFloor: false,
    hasMonthlyRent: false,
    hasDeposit: false,
    hasMaintenance: false,
    hasUpiId: false,
    hasUpiQrUrl: false,
  };

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const key = probes[i];
    const { error } = await supabase.from("flats").select(col).limit(1);
    mode[key] = !error || !isMissingColumn(error);
  }

  cachedSchema = mode;
  return mode;
}

export function clearFlatSchemaCache() {
  cachedSchema = null;
}

type TenancyJoin = {
  id: string;
  monthly_rent: number | string | null;
  security_deposit: number | string | null;
  status: string | null;
  tenants:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};

type FlatRow = {
  id: string;
  flat_number: string | null;
  flat_type: string | null;
  status: string | null;
  notes: string | null;
  building?: string | null;
  floor?: string | number | null;
  monthly_rent?: number | string | null;
  deposit?: number | string | null;
  maintenance_amount?: number | string | null;
  property_id?: string | null;
  upi_id?: string | null;
  upi_qr_url?: string | null;
  tenancies: TenancyJoin | TenancyJoin[] | null;
};

function mapFlatRow(row: FlatRow): FlatListItem {
  const meta = parseFlatMetaFromNotes(row.notes);
  const tenancies = Array.isArray(row.tenancies)
    ? row.tenancies
    : row.tenancies
      ? [row.tenancies]
      : [];

  const currentTenancy =
    tenancies.find((t) => isActiveTenancyStatus(t.status)) ??
    tenancies.find((t) => (t.status ?? "").toLowerCase() === "confirmed") ??
    null;

  const tenant = unwrapOne(currentTenancy?.tenants ?? null);
  const tenancyRent = num(currentTenancy?.monthly_rent);
  const tenancyDeposit = num(currentTenancy?.security_deposit);
  const columnRent = num(row.monthly_rent);
  const columnDeposit = num(row.deposit);
  const columnMaintenance = num(row.maintenance_amount);

  const occupiedFromTenancy = Boolean(
    currentTenancy && isActiveTenancyStatus(currentTenancy.status)
  );
  const isOccupied =
    occupiedFromTenancy || isOccupiedFlatStatus(row.status);
  const occupancy = occupancyLabel(isOccupied, row.status);

  return {
    id: row.id,
    flatNumber: row.flat_number?.trim() || "—",
    type: row.flat_type?.trim() || "—",
    floor:
      row.floor != null && row.floor !== ""
        ? String(row.floor)
        : meta.floor,
    status: row.status?.trim() || occupancy,
    occupancy,
    rent: columnRent ?? tenancyRent ?? meta.monthlyRent,
    deposit: columnDeposit ?? tenancyDeposit ?? meta.deposit,
    maintenanceAmount: columnMaintenance ?? meta.maintenanceAmount,
    notes: meta.freeNotes,
    source: meta.source,
    tenantName: tenant?.full_name?.trim() || null,
    isOccupied,
    propertyName: row.building?.trim() || PROPERTY_NAME,
    upiId: row.upi_id?.trim() || null,
    upiQrUrl: row.upi_qr_url?.trim() || null,
  };
}

export async function listFlatsForAdmin(
  supabase: SupabaseClient
): Promise<FlatListItem[]> {
  const schema = await detectFlatSchema(supabase);
  const selectParts = [
    "id",
    "flat_number",
    "flat_type",
    "status",
    "notes",
    "building",
    "tenancies ( id, monthly_rent, security_deposit, status, tenants ( full_name ) )",
  ];
  if (schema.hasFloor) selectParts.push("floor");
  if (schema.hasMonthlyRent) selectParts.push("monthly_rent");
  if (schema.hasDeposit) selectParts.push("deposit");
  if (schema.hasMaintenance) selectParts.push("maintenance_amount");
  if (schema.hasPropertyId) selectParts.push("property_id");
  if (schema.hasUpiId) selectParts.push("upi_id");
  if (schema.hasUpiQrUrl) selectParts.push("upi_qr_url");

  const { data, error } = await supabase
    .from("flats")
    .select(selectParts.join(","))
    .order("flat_number", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as FlatRow[]).map(mapFlatRow);
}

export async function getFlatPaymentDetails(
  supabase: SupabaseClient,
  flatId: string
): Promise<{ upiId: string | null; upiQrUrl: string | null } | null> {
  const schema = await detectFlatSchema(supabase);
  const cols = ["id"];
  if (schema.hasUpiId) cols.push("upi_id");
  if (schema.hasUpiQrUrl) cols.push("upi_qr_url");

  const { data, error } = await supabase
    .from("flats")
    .select(cols.join(","))
    .eq("id", flatId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as {
    upi_id?: string | null;
    upi_qr_url?: string | null;
  };
  return {
    upiId: row.upi_id?.trim() || null,
    upiQrUrl: row.upi_qr_url?.trim() || null,
  };
}


export function summarizeFlats(flats: FlatListItem[]) {
  const total = flats.length;
  const occupied = flats.filter((f) => f.isOccupied).length;
  const reserved = flats.filter((f) => f.occupancy === "reserved").length;
  const vacant = Math.max(total - occupied - reserved, 0);
  const rentExpected = flats.reduce(
    (sum, flat) =>
      sum +
      (contributesToRentExpected({ isOccupied: flat.isOccupied, rent: flat.rent })
        ? (flat.rent as number)
        : 0),
    0
  );

  return { total, occupied, vacant, reserved, rentExpected };
}

async function buildFlatPayload(
  supabase: SupabaseClient,
  input: FlatWriteInput,
  existingNotes?: string | null
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  const flatNumber = input.flatNumber.trim();
  if (!flatNumber) return { ok: false, error: "Flat number is required." };

  const flatType = input.flatType.trim();
  if (!flatType) return { ok: false, error: "Flat type is required." };

  const status = input.status.trim() || "vacant";
  const schema = await detectFlatSchema(supabase);
  const existingMeta = parseFlatMetaFromNotes(existingNotes);

  const notes = encodeFlatNotes({
    floor: schema.hasFloor ? null : input.floor,
    monthlyRent: schema.hasMonthlyRent ? null : input.monthlyRent,
    deposit: schema.hasDeposit ? null : input.deposit,
    maintenanceAmount: schema.hasMaintenance ? null : input.maintenanceAmount,
    source: existingMeta.source,
    freeNotes: input.notes,
    encodeFinancialMeta: true,
  });

  const payload: Record<string, unknown> = {
    flat_number: flatNumber,
    flat_type: flatType,
    status,
    notes,
    building: input.property?.name ?? PROPERTY_NAME,
  };

  if (schema.hasPropertyId && input.property?.id) {
    payload.property_id = input.property.id;
  }
  if (schema.hasFloor) {
    const floorNum =
      input.floor == null || input.floor === ""
        ? null
        : Number(input.floor);
    payload.floor =
      floorNum != null && Number.isFinite(floorNum) ? floorNum : null;
  }
  if (schema.hasMonthlyRent) {
    payload.monthly_rent =
      input.monthlyRent != null && Number.isFinite(input.monthlyRent)
        ? input.monthlyRent
        : null;
  }
  if (schema.hasDeposit) {
    payload.deposit =
      input.deposit != null && Number.isFinite(input.deposit)
        ? input.deposit
        : null;
  }
  if (schema.hasMaintenance) {
    payload.maintenance_amount =
      input.maintenanceAmount != null &&
      Number.isFinite(input.maintenanceAmount)
        ? input.maintenanceAmount
        : null;
  }
  if (schema.hasUpiId) {
    payload.upi_id = input.upiId?.trim() || null;
  }
  if (schema.hasUpiQrUrl) {
    payload.upi_qr_url = input.upiQrUrl?.trim() || null;
  }

  return { ok: true, payload };
}

export async function createFlat(
  supabase: SupabaseClient,
  input: FlatWriteInput
): Promise<FlatWriteResult> {
  const built = await buildFlatPayload(supabase, input);
  if (!built.ok) return { ok: false, error: built.error };

  const { data, error } = await supabase
    .from("flats")
    .insert(built.payload)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create flat." };
  }
  return { ok: true, id: data.id };
}

export async function updateFlat(
  supabase: SupabaseClient,
  flatId: string,
  input: FlatWriteInput
): Promise<FlatWriteResult> {
  if (!flatId) return { ok: false, error: "Flat id is required." };

  const { data: existing } = await supabase
    .from("flats")
    .select("id,notes")
    .eq("id", flatId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Flat not found." };

  const built = await buildFlatPayload(supabase, input, existing.notes);
  if (!built.ok) return { ok: false, error: built.error };

  const { error } = await supabase
    .from("flats")
    .update(built.payload)
    .eq("id", flatId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: flatId };
}
