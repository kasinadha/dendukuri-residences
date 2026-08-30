"use server";

import { revalidatePath } from "next/cache";
import {
  appendDuesBreakdownToNotes,
  parseRupeeAmountInput,
  type DuesBreakdown,
} from "@/lib/dues-breakdown";
import { resolveFlatQrDisplayUrl } from "@/lib/flat-qr-upload";
import {
  uploadPublicPaymentProof,
  validatePaymentProofFile,
} from "@/lib/payment-proofs";
import {
  getPublicPayDuesBreakdown,
  verifyPublicPayTenantPhone,
} from "@/lib/public-pay-dues";
import {
  lookupFlatForPublicPay,
  submitPublicPaymentClaim,
  type PaymentPurpose,
} from "@/lib/public-pay";
import { resolveRentUpiDisplay } from "@/lib/rent-upi";
import { createClient } from "@/lib/supabase/server";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function asPurpose(raw: string): PaymentPurpose | null {
  const p = raw.toLowerCase();
  if (p === "rent" || p === "advance" || p === "maintenance") return p;
  return null;
}

function parseBreakdownJson(raw: string): DuesBreakdown | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DuesBreakdown;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function resolveFlatDisplay(flat: {
  flatId: string;
  flatNumber: string;
  status: string | null;
  upiId: string | null;
  upiQrUrl: string | null;
}) {
  const supabase = await createClient();
  const storedQrUrl = await resolveFlatQrDisplayUrl(supabase, flat.upiQrUrl);
  const upi = resolveRentUpiDisplay({
    upiId: flat.upiId,
    upiQrUrl: storedQrUrl,
  });

  return {
    flatId: flat.flatId,
    flatNumber: flat.flatNumber,
    status: flat.status,
    displayUpiId: upi.upiId,
    displayUpiQrUrl: storedQrUrl || upi.upiQrUrl,
    payeeName: upi.payeeName,
  };
}

export async function lookupPublicFlatAction(formData: FormData) {
  const supabase = await createClient();
  const flatNumber = asString(formData, "flat_number");
  const payerPhone = asString(formData, "payer_phone");
  const billingMonth = asString(formData, "billing_month") || null;

  const result = await lookupFlatForPublicPay(supabase, flatNumber);
  if (!result.ok) return result;

  const flat = await resolveFlatDisplay(result.flat);

  if (!payerPhone) {
    return {
      ok: true as const,
      flat,
      tenantName: null,
      breakdown: null,
    };
  }

  const verified = await verifyPublicPayTenantPhone(
    supabase,
    flatNumber,
    payerPhone
  );
  if (!verified.ok) {
    return {
      ok: true as const,
      flat,
      tenantName: null,
      breakdown: null,
      verificationError: verified.error,
    };
  }

  let breakdown = null;
  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const dues = await getPublicPayDuesBreakdown({
      tenancyId: verified.tenancyId,
      flatId: verified.flatId,
      billingMonthKey: billingMonth,
    });
    if (dues.ok) breakdown = dues.breakdown;
  }

  return {
    ok: true as const,
    flat,
    tenantName: verified.tenantName,
    breakdown,
  };
}

export async function submitPublicPayClaimAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const purpose = asPurpose(asString(formData, "purpose"));
    if (!purpose) {
      return { ok: false as const, error: "Choose Rent, Advance, or Maintenance." };
    }

    const flatNumber = asString(formData, "flat_number");
    if (!flatNumber) {
      return { ok: false as const, error: "Flat number is required." };
    }

    const amount = parseRupeeAmountInput(asString(formData, "amount"));
    if (amount == null) {
      return { ok: false as const, error: "Enter a valid amount." };
    }

    const proofFile = asFile(formData, "proof");
    const validated = validatePaymentProofFile(proofFile);
    if (!validated.ok) return { ok: false as const, error: validated.error };

    let proofPath: string | null = null;
    if (validated.file) {
      const uploaded = await uploadPublicPaymentProof(supabase, validated.file);
      if (!uploaded.ok) return { ok: false as const, error: uploaded.error };
      proofPath = uploaded.path;
    }

    const lookup = await lookupFlatForPublicPay(supabase, flatNumber);
    if (!lookup.ok) return lookup;

    const { upiId } = resolveRentUpiDisplay({
      upiId: lookup.flat.upiId,
      upiQrUrl: lookup.flat.upiQrUrl,
    });

    const billingMonth = asString(formData, "billing_month") || null;
    const breakdown = parseBreakdownJson(asString(formData, "dues_breakdown_json"));
    const userNotes = asString(formData, "notes") || null;
    const notes = appendDuesBreakdownToNotes(userNotes, breakdown);

    const result = await submitPublicPaymentClaim(supabase, {
      flatNumber,
      purpose,
      amount,
      paymentDate: asString(formData, "payment_date"),
      utr: asString(formData, "utr"),
      payerName: asString(formData, "payer_name"),
      payerPhone: asString(formData, "payer_phone"),
      billingMonth: purpose === "rent" ? billingMonth : billingMonth,
      notes,
      upiId,
      proofPath,
    });

    if (result.ok) {
      revalidatePath("/pay");
      revalidatePath("/admin/payments");
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Body exceeded|body size limit|413/i.test(message)) {
      return {
        ok: false as const,
        error:
          "Upload is too large. Remove the screenshot or use a smaller image (under 5 MB).",
      };
    }
    return {
      ok: false as const,
      error: message || "Could not submit payment claim.",
    };
  }
}
