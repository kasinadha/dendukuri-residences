"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { endTenancy, transferTenancy } from "@/lib/tenancies";
import {
  createTenantPortalLogin,
  resetTenantPortalPassword,
} from "@/lib/tenant-auth";
import { reviewNameChangeRequest } from "@/lib/tenant-change-requests";
import {
  archiveTenant,
  mergeStaleTenantIntoCanonical,
  recordTenancyVacateDate,
  updateTenantProfile,
  updateTenantTenancyTerms,
  updateTenancyMoveInDate,
} from "@/lib/tenants";
import { syncMoveInDatesFromPaymentCsv } from "@/lib/sync-move-in-dates";

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
    status: "vacated",
  });
  if (result.ok) revalidateOccupancy();
  return result;
}

export async function archiveTenantAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenantId = asString(formData, "tenant_id");
  if (!tenantId) return { ok: false as const, error: "Missing tenant." };

  const result = await archiveTenant(supabase, tenantId);
  if (result.ok) revalidateOccupancy();
  return result;
}

export async function recordVacateDateAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  const endDate = asString(formData, "end_date");
  if (!tenancyId) return { ok: false as const, error: "Missing tenancy." };

  const result = await recordTenancyVacateDate(supabase, {
    tenancyId,
    endDate,
  });
  if (result.ok) revalidateOccupancy();
  return result;
}

export async function mergeDuplicateTenantAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const staleTenantId = asString(formData, "stale_tenant_id");
  const canonicalTenantId = asString(formData, "canonical_tenant_id");
  if (!staleTenantId || !canonicalTenantId) {
    return { ok: false as const, error: "Missing tenant records to merge." };
  }

  const result = await mergeStaleTenantIntoCanonical(supabase, {
    staleTenantId,
    canonicalTenantId,
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
    depositReturned: asOptionalNumber(formData, "deposit_returned"),
    depositReturnedDate: asString(formData, "deposit_returned_date") || null,
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
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/flats");
    revalidatePath("/admin/agreements");
  }
  return result;
}

export async function updateTenancyMoveInDateAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  if (!tenancyId) return { ok: false as const, error: "Missing tenancy." };

  const result = await updateTenancyMoveInDate(supabase, {
    tenancyId,
    startDate: asString(formData, "start_date") || null,
  });

  if (result.ok) revalidateOccupancy();
  return result;
}

export async function syncMoveInDatesFromCsvAction() {
  const { supabase } = await requireAdmin();
  const summary = await syncMoveInDatesFromPaymentCsv(supabase);
  if (summary.errors.length === 0) {
    revalidateOccupancy();
  }
  return { ok: true as const, summary };
}

export async function approveNameChangeAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await reviewNameChangeRequest(supabase, {
    id: asString(formData, "id"),
    decision: "approved",
    reviewedBy: user.id,
  });
  if (result.ok) {
    revalidateOccupancy();
    revalidatePath("/tenant");
  }
  return result;
}

export async function rejectNameChangeAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await reviewNameChangeRequest(supabase, {
    id: asString(formData, "id"),
    decision: "rejected",
    adminNote: asString(formData, "admin_note") || null,
    reviewedBy: user.id,
  });
  if (result.ok) {
    revalidateOccupancy();
    revalidatePath("/tenant");
  }
  return result;
}
