import type { SupabaseClient } from "@supabase/supabase-js";

export type VoidPaymentResult =
  | {
      ok: true;
      paymentId: string;
      receiptNumber: string | null;
      submissionReset: number;
    }
  | { ok: false; error: string };

/**
 * Permanently removes a payment and its receipt(s). Clears linked UTR submissions
 * back to pending so they can be re-approved. Monthly dues recalculate from
 * remaining payments automatically.
 */
export async function voidPaymentRecord(
  supabase: SupabaseClient,
  paymentId: string
): Promise<VoidPaymentResult> {
  const id = paymentId.trim();
  if (!id) return { ok: false, error: "Missing payment id." };

  const { data: payment, error: loadError } = await supabase
    .from("payments")
    .select("id,tenancy_id,amount_paid,payment_date,notes")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: loadError.message };
  }
  if (!payment) {
    return { ok: false, error: "Payment not found or already removed." };
  }

  const { data: receipts, error: receiptLoadError } = await supabase
    .from("receipts")
    .select("id,receipt_number")
    .eq("payment_id", id);

  if (receiptLoadError) {
    return { ok: false, error: receiptLoadError.message };
  }

  const receiptNumber = receipts?.[0]?.receipt_number ?? null;

  if (receipts && receipts.length > 0) {
    const { error: receiptDeleteError } = await supabase
      .from("receipts")
      .delete()
      .eq("payment_id", id);

    if (receiptDeleteError) {
      return {
        ok: false,
        error: `Could not delete receipt: ${receiptDeleteError.message}`,
      };
    }
  }

  const { data: linkedSubmissions, error: submissionLoadError } = await supabase
    .from("payment_submissions")
    .select("id")
    .eq("payment_id", id);

  if (submissionLoadError && !/column .* does not exist/i.test(submissionLoadError.message)) {
    return { ok: false, error: submissionLoadError.message };
  }

  let submissionReset = 0;
  if (linkedSubmissions && linkedSubmissions.length > 0) {
    const { error: submissionUpdateError } = await supabase
      .from("payment_submissions")
      .update({
        payment_id: null,
        status: "pending",
        admin_notes: "Payment voided by admin — re-approve if still valid.",
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", id);

    if (submissionUpdateError) {
      return {
        ok: false,
        error: `Could not reset linked UTR submission: ${submissionUpdateError.message}`,
      };
    }
    submissionReset = linkedSubmissions.length;
  }

  const { error: paymentDeleteError } = await supabase
    .from("payments")
    .delete()
    .eq("id", id);

  if (paymentDeleteError) {
    return {
      ok: false,
      error: `Could not delete payment: ${paymentDeleteError.message}`,
    };
  }

  return {
    ok: true,
    paymentId: id,
    receiptNumber,
    submissionReset,
  };
}
