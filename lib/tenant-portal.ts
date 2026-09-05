import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { getTenantDuesSupabaseClient } from "@/lib/tenant-dues-client";

export type TenantPortalContext = {
  tenantId: string;
  fullName: string;
  tenancyId: string | null;
  flatId: string | null;
  flatNumber: string | null;
  monthlyRent: number | null;
  tenancyStatus: string | null;
};

type TenancyRow = {
  id: string;
  status: string | null;
  monthly_rent: number | string | null;
  flat_id: string | null;
  flats: { id: string; flat_number: string } | { id: string; flat_number: string }[] | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function pickPortalTenancy(tenancies: TenancyRow[]): TenancyRow | null {
  const active = tenancies.find((t) => isActiveTenancyStatus(t.status));
  if (active) return active;
  const confirmed = tenancies.find(
    (t) => (t.status ?? "").toLowerCase() === "confirmed"
  );
  if (confirmed) return confirmed;
  return tenancies[0] ?? null;
}

async function resolveFlatNumber(
  client: SupabaseClient,
  flatId: string | null,
  nestedFlat: { id: string; flat_number: string } | null
): Promise<{ flatId: string | null; flatNumber: string | null }> {
  const fromNested = nestedFlat?.flat_number?.trim() || null;
  if (fromNested) {
    return {
      flatId: flatId ?? nestedFlat?.id ?? null,
      flatNumber: fromNested,
    };
  }
  if (!flatId) return { flatId: null, flatNumber: null };

  const { data: flatRow } = await client
    .from("flats")
    .select("id, flat_number")
    .eq("id", flatId)
    .maybeSingle();

  return {
    flatId,
    flatNumber: flatRow?.flat_number?.trim() || null,
  };
}

/**
 * Resolves the signed-in auth user → tenants.profile_id → active tenancy/flat.
 */
export async function getTenantPortalContext(
  supabase: SupabaseClient,
  profileId: string
): Promise<TenantPortalContext | null> {
  const client = getTenantDuesSupabaseClient(supabase);
  const { data: tenant, error } = await client
    .from("tenants")
    .select(
      `
      id,
      full_name,
      tenancies (
        id,
        status,
        monthly_rent,
        flat_id,
        flats ( id, flat_number )
      )
    `
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !tenant) return null;

  const tenancies = Array.isArray(tenant.tenancies)
    ? (tenant.tenancies as TenancyRow[])
    : tenant.tenancies
      ? [tenant.tenancies as TenancyRow]
      : [];

  const active = pickPortalTenancy(tenancies);
  const flat = unwrapOne(active?.flats ?? null);
  const rentRaw =
    active?.monthly_rent == null ? null : Number(active.monthly_rent);
  const { flatId, flatNumber } = await resolveFlatNumber(
    client,
    active?.flat_id ?? flat?.id ?? null,
    flat
  );

  return {
    tenantId: tenant.id,
    fullName: tenant.full_name?.trim() || "Tenant",
    tenancyId: active?.id ?? null,
    flatId,
    flatNumber,
    monthlyRent:
      rentRaw != null && Number.isFinite(rentRaw) ? rentRaw : null,
    tenancyStatus: active?.status ?? null,
  };
}
