"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  clearFlatSchemaCache,
  updateFlat,
  type FlatWriteResult,
} from "@/lib/flats";
import {
  importRentalTrackingCsv,
  type ImportSummary,
} from "@/lib/import-rental-csv";
import { ensureDendukuriProperty } from "@/lib/property";
import {
  createTenancyLink,
  ensureD201Seed,
  type CreateTenancyResult,
  type EnsureD201Result,
} from "@/lib/tenancies";
import { updateTenancyReview } from "@/lib/tenancy-review";

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

function revalidateFlatPaths() {
  revalidatePath("/admin/flats");
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
}

export async function importRentalCsvAction(): Promise<
  { ok: true; summary: ImportSummary } | { ok: false; error: string }
> {
  const { supabase } = await requireAdmin();
  clearFlatSchemaCache();
  try {
    const summary = await importRentalTrackingCsv(supabase);
    revalidateFlatPaths();
    if (summary.errors.length && summary.flatsCreated === 0 && summary.tenanciesCreated === 0) {
      return {
        ok: false,
        error: summary.errors[0] ?? "Import failed.",
      };
    }
    return { ok: true, summary };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Import failed unexpectedly.",
    };
  }
}

export async function updateTenancyReviewAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const result = await updateTenancyReview(supabase, {
    id: asString(formData, "id"),
    monthlyRent: asOptionalNumber(formData, "monthly_rent"),
    depositAmount: asOptionalNumber(formData, "deposit_amount"),
    depositPaid: asOptionalNumber(formData, "deposit_paid"),
    depositPaidDate: asString(formData, "deposit_paid_date") || null,
    startDate: asString(formData, "start_date") || null,
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) revalidateFlatPaths();
  return result;
}

export async function createFlatAction(
  formData: FormData
): Promise<FlatWriteResult> {
  await requireAdmin();
  void formData;
  return {
    ok: false,
    error:
      "Inventory is fixed (Building C + D). Edit an existing flat from the inventory list.",
  };
}

export async function updateFlatAction(
  formData: FormData
): Promise<FlatWriteResult> {
  const { supabase } = await requireAdmin();
  clearFlatSchemaCache();
  const property = await ensureDendukuriProperty(supabase);
  const id = asString(formData, "id");

  const result = await updateFlat(supabase, id, {
    flatNumber: asString(formData, "flat_number"),
    flatType: asString(formData, "flat_type"),
    floor: asString(formData, "floor") || null,
    status: asString(formData, "status") || "vacant",
    monthlyRent: asOptionalNumber(formData, "monthly_rent"),
    deposit: asOptionalNumber(formData, "deposit"),
    maintenanceAmount: asOptionalNumber(formData, "maintenance_amount"),
    notes: asString(formData, "notes") || null,
    upiId: asString(formData, "upi_id") || null,
    upiQrUrl: asString(formData, "upi_qr_url") || null,
    property,
  });

  if (result.ok) {
    revalidateFlatPaths();
    revalidatePath("/tenant/pay");
  }
  return result;
}

export async function assignTenancy(
  formData: FormData
): Promise<CreateTenancyResult> {
  const { supabase } = await requireAdmin();

  const mode = asString(formData, "mode") || "existing_flat";
  if (mode === "new_flat") {
    return {
      ok: false,
      error:
        "New flats cannot be added. Select a vacant flat from Building C or D.",
    };
  }

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

  if (result.ok) revalidateFlatPaths();
  return result;
}

export async function seedD201Action(): Promise<EnsureD201Result> {
  const { supabase } = await requireAdmin();
  const result = await ensureD201Seed(supabase);

  if (result.ok) revalidateFlatPaths();
  return result;
}
