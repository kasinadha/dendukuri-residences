"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { getFlatPaymentDetails } from "@/lib/flats";
import { createMaintenanceRequest } from "@/lib/maintenance";
import { createVacateRequest } from "@/lib/ops";
import {
  uploadPaymentProof,
  validatePaymentProofFile,
} from "@/lib/payment-proofs";
import { createPaymentSubmission } from "@/lib/payment-submissions";
import {
  getTenancyDuesBreakdown,
  parseDuesBreakdownJson,
} from "@/lib/public-pay-dues";
import { resolveRentUpiDisplay } from "@/lib/rent-upi";
import { getTenantPortalContext } from "@/lib/tenant-portal";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

export async function fetchTenantDuesBreakdownAction(formData: FormData) {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  if (!ctx?.tenancyId || !ctx.flatId) {
    return { ok: false as const, error: "No active tenancy on your account." };
  }

  const billingMonth = asString(formData, "billing_month");
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false as const, error: "Billing month is invalid." };
  }

  return getTenancyDuesBreakdown(supabase, {
    tenancyId: ctx.tenancyId,
    flatId: ctx.flatId,
    billingMonthKey: billingMonth,
  });
}

export async function tenantSubmitRentPayment(formData: FormData) {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  if (!ctx?.tenancyId) {
    return { ok: false as const, error: "No active tenancy on your account." };
  }

  const tenancyId = asString(formData, "tenancy_id") || ctx.tenancyId;
  if (tenancyId !== ctx.tenancyId) {
    return { ok: false as const, error: "Invalid tenancy." };
  }

  const proofFile = asFile(formData, "proof");
  const validated = validatePaymentProofFile(proofFile);
  if (!validated.ok) return { ok: false as const, error: validated.error };

  let proofPath: string | null = null;
  if (validated.file) {
    const uploaded = await uploadPaymentProof(supabase, {
      userId: user.id,
      file: validated.file,
    });
    if (!uploaded.ok) return { ok: false as const, error: uploaded.error };
    proofPath = uploaded.path;
  }

  const flatUpi = ctx.flatId
    ? await getFlatPaymentDetails(supabase, ctx.flatId)
    : null;
  const { upiId } = resolveRentUpiDisplay(flatUpi);
  const amount = Number(asString(formData, "amount"));
  const billingMonth = asString(formData, "billing_month");

  let duesBreakdown = parseDuesBreakdownJson(
    asString(formData, "dues_breakdown_json")
  );
  if (!duesBreakdown && ctx.flatId) {
    const breakdownResult = await getTenancyDuesBreakdown(supabase, {
      tenancyId,
      flatId: ctx.flatId,
      billingMonthKey: billingMonth,
    });
    if (breakdownResult.ok) duesBreakdown = breakdownResult.breakdown;
  }

  const result = await createPaymentSubmission(supabase, {
    tenancyId,
    billingMonth,
    amount,
    paymentDate: asString(formData, "payment_date"),
    utr: asString(formData, "utr"),
    upiId,
    notes: asString(formData, "notes") || null,
    duesBreakdown,
    proofPath,
    submittedBy: user.id,
  });

  if (result.ok) {
    revalidatePath("/tenant");
    revalidatePath("/tenant/pay");
    revalidatePath("/admin/payments");
  }
  return result;
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

  const requestTypeRaw = asString(formData, "request_type");
  const result = await createVacateRequest(supabase, {
    tenancyId: ctx.tenancyId,
    reason: asString(formData, "reason") || null,
    requestType: requestTypeRaw === "transfer" ? "transfer" : "vacate",
    preferredFlatNumber: asString(formData, "preferred_flat_number") || null,
  });

  if (result.ok) {
    revalidatePath("/tenant");
    revalidatePath("/tenant/vacate");
    revalidatePath("/admin/reports");
  }
  return result;
}
