"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantLoginUrl } from "@/lib/site-url";
import { endTenancy, transferTenancy } from "@/lib/tenancies";
import {
  createTenantPortalLogin,
  resetTenantPortalPassword,
} from "@/lib/tenant-auth";
import { tenantPortalInviteWhatsAppUrl } from "@/lib/tenant-portal-invite";
import { updateTenantProfile, updateTenantTenancyTerms } from "@/lib/tenants";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(formData: FormData, key: string): number | null {
  const raw = asString(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
  const { supabase } = await requireAdmin();
  const adminResult = createAdminClient();
  if (!adminResult.ok) return adminResult;

  const tenantId = asString(formData, "tenant_id");
  const mobile = asString(formData, "mobile");
  const password = asString(formData, "password");

  const result = await createTenantPortalLogin(adminResult.client, {
    tenantId,
    mobile,
    password,
    email: asString(formData, "email") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/tenants");

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select(
        `
        full_name,
        phone,
        tenancies (
          flats ( flat_number )
        )
      `
      )
      .eq("id", tenantId)
      .maybeSingle();

    const tenancy = Array.isArray(tenantRow?.tenancies)
      ? tenantRow.tenancies[0]
      : tenantRow?.tenancies;
    const flat = Array.isArray(tenancy?.flats)
      ? tenancy.flats[0]
      : tenancy?.flats;

    const loginUrl = await getTenantLoginUrl();
    const whatsappUrl = tenantPortalInviteWhatsAppUrl({
      tenantPhone: tenantRow?.phone ?? mobile,
      tenantName: tenantRow?.full_name?.trim() || "Tenant",
      flatNumber: flat?.flat_number ?? null,
      mobile,
      password,
      loginUrl,
    });

    return {
      ok: true as const,
      loginEmail: result.loginEmail,
      whatsappUrl,
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

export async function updateTenantDetailsAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const result = await updateTenantProfile(supabase, {
    tenantId: asString(formData, "tenant_id"),
    fullName: asString(formData, "full_name"),
    phone: asString(formData, "phone") || null,
    email: asString(formData, "email") || null,
  });

  if (result.ok) {
    revalidateOccupancy();
  }
  return result;
}

export async function updateTenantTermsAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  if (!tenancyId) return { ok: false as const, error: "Missing tenancy." };

  const result = await updateTenantTenancyTerms(supabase, {
    tenancyId,
    monthlyRent: asOptionalNumber(formData, "monthly_rent"),
    depositAmount: asOptionalNumber(formData, "deposit_amount"),
    depositPaid: asOptionalNumber(formData, "deposit_paid"),
    depositPaidDate: asString(formData, "deposit_paid_date") || null,
    maintenanceCharge: asOptionalNumber(formData, "maintenance_charge"),
    carParkingCharge: asOptionalNumber(formData, "car_parking_charge"),
    washingMachineCharge: asOptionalNumber(formData, "washing_machine_charge"),
    otherMonthlyCharge: asOptionalNumber(formData, "other_monthly_charge"),
    otherChargesNotes: asString(formData, "other_charges_notes") || null,
    termsConfirmed: asString(formData, "terms_confirmed") === "yes",
  });

  if (result.ok) {
    revalidateOccupancy();
    revalidatePath("/admin/payments");
    revalidatePath("/admin/flats");
  }
  return result;
}
