"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createTenancyLink,
  ensureD201Seed,
  type CreateTenancyResult,
  type EnsureD201Result,
} from "@/lib/tenancies";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function assignTenancy(
  formData: FormData
): Promise<CreateTenancyResult> {
  const { supabase } = await requireAdmin();

  const mode = asString(formData, "mode") || "existing_flat";
  const flatId = asString(formData, "flat_id");
  const flatNumber = asString(formData, "flat_number");
  const flatType = asString(formData, "flat_type");
  const tenantFullName = asString(formData, "tenant_full_name");
  const tenantEmail = asString(formData, "tenant_email");
  const tenantPhone = asString(formData, "tenant_phone");
  const monthlyRent = Number(asString(formData, "monthly_rent"));
  const securityDeposit = Number(asString(formData, "security_deposit"));
  const source = asString(formData, "source");
  const startDate = asString(formData, "start_date");

  const result = await createTenancyLink(supabase, {
    flatId: mode === "existing_flat" ? flatId || undefined : undefined,
    flatNumber:
      mode === "new_flat" ? flatNumber || undefined : flatNumber || undefined,
    flatType: flatType || null,
    tenantFullName,
    tenantEmail: tenantEmail || null,
    tenantPhone: tenantPhone || null,
    monthlyRent,
    securityDeposit,
    source: source || null,
    startDate,
    status: "active",
  });

  if (result.ok) {
    revalidatePath("/admin/flats");
    revalidatePath("/admin/tenants");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
  }

  return result;
}

export async function seedD201Action(): Promise<EnsureD201Result> {
  const { supabase } = await requireAdmin();
  const result = await ensureD201Seed(supabase);

  if (result.ok) {
    revalidatePath("/admin/flats");
    revalidatePath("/admin/tenants");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
  }

  return result;
}
