"use server";

import { revalidatePath } from "next/cache";
import {
  uploadPublicPaymentProof,
  validatePaymentProofFile,
} from "@/lib/payment-proofs";
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

export async function lookupPublicFlatAction(formData: FormData) {
  const supabase = await createClient();
  const flatNumber = asString(formData, "flat_number");
  const result = await lookupFlatForPublicPay(supabase, flatNumber);
  if (!result.ok) return result;

  const upi = resolveRentUpiDisplay({
    upiId: result.flat.upiId,
    upiQrUrl: result.flat.upiQrUrl,
  });

  return {
    ok: true as const,
    flat: {
      flatId: result.flat.flatId,
      flatNumber: result.flat.flatNumber,
      status: result.flat.status,
      displayUpiId: upi.upiId,
      displayUpiQrUrl: upi.upiQrUrl,
      payeeName: upi.payeeName,
    },
  };
}

export async function submitPublicPayClaimAction(formData: FormData) {
  const supabase = await createClient();

  const purpose = asPurpose(asString(formData, "purpose"));
  if (!purpose) {
    return { ok: false as const, error: "Choose Rent, Advance, or Maintenance." };
  }

  const flatNumber = asString(formData, "flat_number");
  if (!flatNumber) {
    return { ok: false as const, error: "Flat number is required." };
  }

  const amount = Number(asString(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
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

  const result = await submitPublicPaymentClaim(supabase, {
    flatNumber,
    purpose,
    amount,
    paymentDate: asString(formData, "payment_date"),
    utr: asString(formData, "utr"),
    payerName: asString(formData, "payer_name"),
    payerPhone: asString(formData, "payer_phone"),
    billingMonth: purpose === "rent" ? billingMonth : billingMonth,
    notes: asString(formData, "notes") || null,
    upiId,
    proofPath,
  });

  if (result.ok) {
    revalidatePath("/pay");
    revalidatePath("/admin/payments");
  }
  return result;
}
