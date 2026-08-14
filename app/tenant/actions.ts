"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { createMaintenanceRequest } from "@/lib/maintenance";
import { createVacateRequest } from "@/lib/ops";
import { getTenantPortalContext } from "@/lib/tenant-portal";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function tenantCreateMaintenance(formData: FormData) {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  if (!ctx?.flatId) {
    return { ok: false as const, error: "No flat linked to your account." };
  }

  const result = await createMaintenanceRequest(supabase, {
    flatId: ctx.flatId,
    title: asString(formData, "title"),
    description: asString(formData, "description") || null,
    status: "open",
    priority: asString(formData, "priority") || "normal",
    category: asString(formData, "category") || "general",
  });

  if (result.ok) {
    revalidatePath("/tenant");
    revalidatePath("/tenant/maintenance");
    revalidatePath("/admin/maintenance");
  }
  return result;
}

export async function tenantCreateVacate(formData: FormData) {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  if (!ctx?.tenancyId) {
    return { ok: false as const, error: "No active tenancy on your account." };
  }

  const result = await createVacateRequest(supabase, {
    tenancyId: ctx.tenancyId,
    reason: asString(formData, "reason") || null,
  });

  if (result.ok) {
    revalidatePath("/tenant");
    revalidatePath("/tenant/vacate");
    revalidatePath("/admin/reports");
  }
  return result;
}
