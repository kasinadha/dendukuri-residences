import { normalizeIndianMobile } from "@/lib/login-identifier";
import type { TenantListItem } from "@/lib/tenants";

export type TenantDuplicateMergeTarget = {
  canonicalTenantId: string;
  canonicalName: string;
  canonicalFlatNumber: string | null;
};

export function tenantPhoneKey(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return normalizeIndianMobile(phone);
}

/** Former tenant rows that likely duplicate an active tenant (same mobile). */
export function buildTenantDuplicateMergeMap(
  tenants: TenantListItem[]
): Map<string, TenantDuplicateMergeTarget> {
  const activeByPhone = new Map<string, TenantListItem>();

  for (const tenant of tenants) {
    if (tenant.isArchived || !tenant.hasActiveTenancy) continue;
    const phoneKey = tenantPhoneKey(tenant.phone);
    if (!phoneKey) continue;
    activeByPhone.set(phoneKey, tenant);
  }

  const merges = new Map<string, TenantDuplicateMergeTarget>();

  for (const tenant of tenants) {
    if (tenant.isArchived || tenant.hasActiveTenancy) continue;

    const phoneKey = tenantPhoneKey(tenant.phone);
    if (!phoneKey) continue;

    const canonical = activeByPhone.get(phoneKey);
    if (!canonical || canonical.id === tenant.id) continue;

    merges.set(tenant.id, {
      canonicalTenantId: canonical.id,
      canonicalName: canonical.fullName,
      canonicalFlatNumber: canonical.flatNumber,
    });
  }

  return merges;
}
