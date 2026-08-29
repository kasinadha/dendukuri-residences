import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentPurpose = "rent" | "advance" | "maintenance";

export type PublicFlatPayInfo = {
  flatId: string;
  flatNumber: string;
  status: string | null;
  upiId: string | null;
  upiQrUrl: string | null;
};

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function purposeLabel(purpose: PaymentPurpose | string | null | undefined): string {
  switch (purpose) {
    case "advance":
      return "Advance (deposit)";
    case "maintenance":
      return "Maintenance";
    case "rent":
      return "Rent";
    default:
      return purpose?.trim() || "Payment";
  }
}

export async function lookupFlatForPublicPay(
  supabase: SupabaseClient,
  flatNumber: string
): Promise<
  | { ok: true; flat: PublicFlatPayInfo }
  | { ok: false; error: string }
> {
  const trimmed = flatNumber.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a flat number." };
  }

  const { data, error } = await supabase.rpc("lookup_flat_for_public_pay", {
    p_flat_number: trimmed,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/lookup_flat_for_public_pay|could not find|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Public pay is not set up yet. Ask the owner to run the public payment claims migration.",
      };
    }
    if (/monthly_rent does not exist|deposit does not exist|maintenance_amount does not exist/i.test(msg)) {
      return {
        ok: false,
        error:
          "Flat lookup needs a privacy update. Run supabase/migrations/20260829_public_pay_no_amount_leak.sql in Supabase.",
      };
    }
    return { ok: false, error: msg || "Could not look up flat." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.flat_id) {
    return { ok: false, error: "Flat number not found. Check the number and try again." };
  }

  return {
    ok: true,
    flat: {
      flatId: row.flat_id as string,
      flatNumber: String(row.flat_number ?? trimmed).trim(),
      status: row.status != null ? String(row.status) : null,
      upiId: asTrimmedString(row.upi_id),
      upiQrUrl: asTrimmedString(row.upi_qr_url),
    },
  };
}

export async function submitPublicPaymentClaim(
  supabase: SupabaseClient,
  input: {
    flatNumber: string;
    purpose: PaymentPurpose;
    amount: number;
    paymentDate: string;
    utr: string;
    payerName: string;
    payerPhone: string;
    billingMonth?: string | null;
    notes?: string | null;
    upiId?: string | null;
    proofPath?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("submit_public_payment_claim", {
    p_flat_number: input.flatNumber.trim(),
    p_purpose: input.purpose,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_utr: input.utr.trim(),
    p_payer_name: input.payerName.trim(),
    p_payer_phone: input.payerPhone.trim(),
    p_billing_month: input.billingMonth?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_upi_id: input.upiId?.trim() || null,
    p_proof_path: input.proofPath?.trim() || null,
  });

  if (error || !data) {
    const msg = error?.message ?? "";
    if (/submit_public_payment_claim|could not find|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Public pay is not set up yet. Ask the owner to run the public payment claims migration.",
      };
    }
    return { ok: false, error: msg || "Could not submit payment claim." };
  }

  return { ok: true, id: String(data) };
}
