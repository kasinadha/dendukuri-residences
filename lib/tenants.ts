import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";

export type TenantListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  flatNumber: string | null;
  flatType: string | null;
  monthlyRent: number | null;
  tenancyStatus: string | null;
  hasActiveTenancy: boolean;
  tenancyId: string | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

type FlatJoin = {
  flat_number: string | null;
  flat_type: string | null;
  status: string | null;
};

type TenancyJoin = {
  id: string;
  status: string | null;
  monthly_rent: number | string | null;
  flats: FlatJoin | FlatJoin[] | null;
};

type TenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tenancies: TenancyJoin | TenancyJoin[] | null;
};

export async function listTenantsForAdmin(
  supabase: SupabaseClient
): Promise<TenantListItem[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      tenancies (
        id,
        status,
        monthly_rent,
        flats ( flat_number, flat_type, status )
      )
    `
    )
    .order("full_name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as unknown as TenantRow[]).map((row) => {
    const tenancies = Array.isArray(row.tenancies)
      ? row.tenancies
      : row.tenancies
        ? [row.tenancies]
        : [];

    const activeTenancy =
      tenancies.find((t) => isActiveTenancyStatus(t.status)) ??
      tenancies[0] ??
      null;

    const flat = unwrapOne(activeTenancy?.flats ?? null);
    const rentRaw =
      activeTenancy?.monthly_rent == null
        ? null
        : Number(activeTenancy.monthly_rent);
    const monthlyRent =
      rentRaw != null && Number.isFinite(rentRaw) ? rentRaw : null;

    return {
      id: row.id,
      fullName: row.full_name?.trim() || "—",
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      flatNumber: flat?.flat_number?.trim() || null,
      flatType: flat?.flat_type?.trim() || null,
      monthlyRent,
      tenancyStatus: activeTenancy?.status?.trim() || null,
      hasActiveTenancy: Boolean(
        activeTenancy && isActiveTenancyStatus(activeTenancy.status)
      ),
      tenancyId:
        activeTenancy && isActiveTenancyStatus(activeTenancy.status)
          ? activeTenancy.id
          : null,
    };
  });
}
