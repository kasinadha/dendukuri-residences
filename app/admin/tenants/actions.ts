"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { endTenancy, transferTenancy } from "@/lib/tenancies";
import {
  createTenantPortalLogin,
  resetTenantPortalPassword,
} from "@/lib/tenant-auth";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateOccupancy() {
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/flats");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/tenant");
}

export async function markTenantVacatedAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  if (!tenancyId) return { ok: false as const, error: "Missing tenancy." };
  const result = await endTenancy(supabase, {
    tenancyId,
    endDate: asString(formData, "end_date") || null,
    status: "ended",
  });
  if (result.ok) revalidateOccupancy();
  return result;
}

export async function transferTenantAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const rentRaw = asString(formData, "monthly_rent");
  const result = await transferTenancy(supabase, {
    fromTenancyId: asString(formData, "tenancy_id"),
    toFlatId: asString(formData, "target_flat_id"),
    startDate: asString(formData, "start_date") || null,
    monthlyRent: rentRaw ? Number(rentRaw) : null,
  });
  if (result.ok) revalidateOccupancy();
  return result;
}

export async function createTenantLoginAction(formData: FormData) {
  await requireAdmin();
  const adminResult = createAdminClient();
  if (!adminResult.ok) return adminResult;

  const result = await createTenantPortalLogin(adminResult.client, {
    tenantId: asString(formData, "tenant_id"),
    mobile: asString(formData, "mobile"),
    password: asString(formData, "password"),
    email: asString(formData, "email") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/tenants");
    return {
      ok: true as const,
      loginEmail: result.loginEmail,
    };
  }
  return result;
}

export async function resetTenantPasswordAction(formData: FormData) {
  await requireAdmin();
  const adminResult = createAdminClient();
  if (!adminResult.ok) return adminResult;

  const result = await resetTenantPortalPassword(adminResult.client, {
    tenantId: asString(formData, "tenant_id"),
    password: asString(formData, "password"),
  });

  if (result.ok) revalidatePath("/admin/tenants");
  return result;
}
