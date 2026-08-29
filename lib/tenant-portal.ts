import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";

export type TenantPortalContext = {
  tenantId: string;
  fullName: string;
  tenancyId: string | null;
  flatId: string | null;
  flatNumber: string | null;
  monthlyRent: number | null;
  tenancyStatus: string | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Resolves the signed-in auth user → tenants.profile_id → active tenancy/flat.
 */
export async function getTenantPortalContext(
  supabase: SupabaseClient,
  profileId: string
): Promise<TenantPortalContext | null> {
  const { data: tenant, error } = await supabase
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
    ? tenant.tenancies
    : tenant.tenancies
      ? [tenant.tenancies]
      : [];

  const active =
    tenancies.find((t) => isActiveTenancyStatus(t.status)) ?? null;
  const flat = unwrapOne(active?.flats ?? null);
  const rentRaw =
    active?.monthly_rent == null ? null : Number(active.monthly_rent);

  return {
    tenantId: tenant.id,
    fullName: tenant.full_name?.trim() || "Tenant",
    tenancyId: active?.id ?? null,
    flatId: active?.flat_id ?? flat?.id ?? null,
    flatNumber: flat?.flat_number?.trim() || null,
    monthlyRent:
      rentRaw != null && Number.isFinite(rentRaw) ? rentRaw : null,
    tenancyStatus: active?.status ?? null,
  };
}
