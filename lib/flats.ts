import type { SupabaseClient } from "@supabase/supabase-js";
import {
  occupancyLabel,
  parseSourceFromNotes,
} from "@/lib/tenancies";

export type FlatListItem = {
  id: string;
  flatNumber: string;
  type: string;
  status: string;
  occupancy: "occupied" | "vacant";
  rent: number | null;
  deposit: number | null;
  source: string | null;
  tenantName: string | null;
  isOccupied: boolean;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isActiveTenancyStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "active" || value === "occupied" || value === "";
}

function isOccupiedFlatStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "occupied" || value === "active" || value === "rented";
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
  tenancies: TenancyJoin | TenancyJoin[] | null;
};

export async function listFlatsForAdmin(
  supabase: SupabaseClient
): Promise<FlatListItem[]> {
  const { data, error } = await supabase
    .from("flats")
    .select(
      `
      id,
      flat_number,
      flat_type,
      status,
      notes,
      tenancies (
        id,
        monthly_rent,
        security_deposit,
        status,
        tenants ( full_name )
      )
    `
    )
    .order("flat_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as unknown as FlatRow[]).map((row) => {
    const tenancies = Array.isArray(row.tenancies)
      ? row.tenancies
      : row.tenancies
        ? [row.tenancies]
        : [];

    const activeTenancy =
      tenancies.find((t) => isActiveTenancyStatus(t.status)) ??
      tenancies[0] ??
      null;

    const tenant = unwrapOne(activeTenancy?.tenants ?? null);
    const rentRaw =
      activeTenancy?.monthly_rent == null
        ? null
        : Number(activeTenancy.monthly_rent);
    const rent = rentRaw != null && Number.isFinite(rentRaw) ? rentRaw : null;

    const depositRaw =
      activeTenancy?.security_deposit == null
        ? null
        : Number(activeTenancy.security_deposit);
    const deposit =
      depositRaw != null && Number.isFinite(depositRaw) ? depositRaw : null;

    const occupiedFromTenancy = Boolean(
      activeTenancy && isActiveTenancyStatus(activeTenancy.status)
    );
    const isOccupied =
      occupiedFromTenancy || isOccupiedFlatStatus(row.status);
    const occupancy = occupancyLabel(isOccupied);

    return {
      id: row.id,
      flatNumber: row.flat_number?.trim() || "—",
      type: row.flat_type?.trim() || "—",
      status: occupancy,
      occupancy,
      rent,
      deposit,
      source: parseSourceFromNotes(row.notes),
      tenantName: tenant?.full_name?.trim() || null,
      isOccupied,
    };
  });
}

export function summarizeFlats(flats: FlatListItem[]) {
  const total = flats.length;
  const occupied = flats.filter((f) => f.isOccupied).length;
  const vacant = Math.max(total - occupied, 0);
  const rentExpected = flats.reduce(
    (sum, flat) => sum + (flat.isOccupied && flat.rent != null ? flat.rent : 0),
    0
  );

  return { total, occupied, vacant, rentExpected };
}
