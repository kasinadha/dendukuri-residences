"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { acceptTenancyAgreement } from "@/lib/agreements";
import { getFlatPaymentDetails } from "@/lib/flats";
import { createMaintenanceRequest } from "@/lib/maintenance";
import { createVacateRequest } from "@/lib/ops";
import {
  uploadPaymentProof,
  validatePaymentProofFile,
} from "@/lib/payment-proofs";
import { loadPayUpiFallback } from "@/lib/pay-upi-defaults";
import { createPaymentSubmission } from "@/lib/payment-submissions";
import {
  getTenancyDuesBreakdownWithArrears,
  parseDuesBreakdownJson,
} from "@/lib/public-pay-dues";
import { getTenantDuesSupabaseClient } from "@/lib/tenant-dues-client";
import { resolveRentUpiDisplay } from "@/lib/rent-upi";
import { submitNameChangeRequest } from "@/lib/tenant-change-requests";
import { getTenantPortalContext } from "@/lib/tenant-portal";
import { formatActionError } from "@/lib/format-action-error";
import { parseRupeeAmount } from "@/lib/money";

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
  try {
    const ctx = await getTenantPortalContext(supabase, user.id);
    if (!ctx?.tenancyId || !ctx.flatId) {
      return { ok: false as const, error: "No active tenancy on your account." };
    }

    const billingMonth = asString(formData, "billing_month");
    if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
      return { ok: false as const, error: "Billing month is invalid." };
    }

    const duesClient = getTenantDuesSupabaseClient(supabase);

    return getTenancyDuesBreakdownWithArrears(duesClient, {
      tenancyId: ctx.tenancyId,
      flatId: ctx.flatId,
      billingMonthKey: billingMonth,
    });
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not load dues. Try again."),
    };
  }
}

export async function tenantSubmitRentPayment(formData: FormData) {
  const { supabase, user } = await requireTenant();
  try {
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
    const { upiId } = resolveRentUpiDisplay(flatUpi, await loadPayUpiFallback());
    const amount = parseRupeeAmount(asString(formData, "amount"));
    const billingMonth = asString(formData, "billing_month");
    if (amount == null) {
      return {
        ok: false as const,
        error: "Enter a valid amount greater than zero.",
      };
    }
    if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
      return { ok: false as const, error: "Billing month is invalid." };
    }

    let duesBreakdown = parseDuesBreakdownJson(
      asString(formData, "dues_breakdown_json")
    );
    if (!duesBreakdown && ctx.flatId) {
      const duesClient = getTenantDuesSupabaseClient(supabase);
      const breakdownResult = await getTenancyDuesBreakdownWithArrears(
        duesClient,
        {
          tenancyId,
          flatId: ctx.flatId,
          billingMonthKey: billingMonth,
        }
      );
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not submit this payment. Try again."),
    };
  }
}

export async function tenantCreateMaintenance(formData: FormData) {
  const { supabase, user } = await requireTenant();
  try {
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not submit the request. Try again."),
    };
  }
}

export async function tenantCreateVacate(formData: FormData) {
  const { supabase, user } = await requireTenant();
  try {
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(
        error,
        "Could not submit the vacate request. Try again."
      ),
    };
  }
}

export async function tenantSubmitNameChangeAction(formData: FormData) {
  const { supabase, user } = await requireTenant();
  try {
    const ctx = await getTenantPortalContext(supabase, user.id);
    if (!ctx?.tenantId) {
      return {
        ok: false as const,
        error: "No tenant record linked to your login.",
      };
    }

    const result = await submitNameChangeRequest(supabase, {
      tenantId: ctx.tenantId,
      currentValue: ctx.fullName,
      requestedValue: asString(formData, "full_name"),
      tenantNote: asString(formData, "tenant_note") || null,
    });

    if (result.ok) {
      revalidatePath("/tenant");
      revalidatePath("/help");
      revalidatePath("/admin/tenants");
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(
        error,
        "Could not submit the name-change request. Try again."
      ),
    };
  }
}

export async function tenantAcceptAgreementAction(formData: FormData) {
  const { supabase, user } = await requireTenant();
  try {
    const ctx = await getTenantPortalContext(supabase, user.id);
    if (!ctx?.tenancyId) {
      return { ok: false as const, error: "No active tenancy on your account." };
    }

    const result = await acceptTenancyAgreement(supabase, {
      id: asString(formData, "agreement_id"),
      tenancyId: ctx.tenancyId,
      checks: {
        rent: asString(formData, "check_rent") === "on",
        maintenance: asString(formData, "check_maintenance") === "on",
        other: asString(formData, "check_other") === "on",
        deposit: asString(formData, "check_deposit") === "on",
        terms: asString(formData, "check_terms") === "on",
      },
    });

    if (result.ok) {
      revalidatePath("/tenant");
      revalidatePath("/tenant/agreement");
      revalidatePath("/admin/agreements");
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not accept the agreement. Try again."),
    };
  }
}
