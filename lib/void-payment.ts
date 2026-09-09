import type { SupabaseClient } from "@supabase/supabase-js";
import { isVoidedPaymentStatus } from "@/lib/payment-status";
import { adjustTenancyDepositPaid } from "@/lib/tenants";

export type VoidPaymentResult =
  | {
      ok: true;
      paymentId: string;
      receiptNumber: string | null;
      submissionReset: number;
    }
  | { ok: false; error: string };

/**
 * Soft-voids a payment: keeps the row and receipt, excludes it from dues,
 * and reverses deposit_paid when the payment was an advance.
 * Linked UTR submissions go back to pending so they can be re-approved.
 */
export async function voidPaymentRecord(
  supabase: SupabaseClient,
  paymentId: string
): Promise<VoidPaymentResult> {
  const id = paymentId.trim();
  if (!id) return { ok: false, error: "Missing payment id." };

  const { data: payment, error: loadError } = await supabase
    .from("payments")
    .select(
      "id,tenancy_id,amount_paid,payment_date,payment_type,status,notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: loadError.message };
  }
  if (!payment) {
    return { ok: false, error: "Payment not found." };
  }
  if (isVoidedPaymentStatus(payment.status)) {
    return { ok: false, error: "This payment is already voided." };
  }

  const { data: receipts, error: receiptLoadError } = await supabase
    .from("receipts")
    .select("id,receipt_number")
    .eq("payment_id", id);

  if (receiptLoadError) {
    return { ok: false, error: receiptLoadError.message };
  }

  const receiptNumber = receipts?.[0]?.receipt_number ?? null;
  const amountPaid = Number(payment.amount_paid);
  const paymentType = String(payment.payment_type ?? "").toLowerCase();

  const { error: voidError } = await supabase
    .from("payments")
    .update({ status: "voided" })
    .eq("id", id);

  if (voidError) {
    if (/payments_status_check/i.test(voidError.message)) {
      return {
        ok: false,
        error:
          "Database does not allow voided payment status yet. Run supabase/migrations/20260906_phase1_integrity_ledger.sql in Supabase, then try again.",
      };
    }
    return { ok: false, error: `Could not void payment: ${voidError.message}` };
  }

  if (paymentType === "advance" && Number.isFinite(amountPaid) && amountPaid > 0) {
    const depositUpdate = await adjustTenancyDepositPaid(supabase, {
      tenancyId: String(payment.tenancy_id),
      amount: -amountPaid,
    });
    if (!depositUpdate.ok) {
      await supabase
        .from("payments")
        .update({ status: payment.status })
        .eq("id", id);
      return {
        ok: false,
        error: `Payment was not voided because deposit reversal failed: ${depositUpdate.error}`,
      };
    }
  }

  const { data: linkedSubmissions, error: submissionLoadError } = await supabase
    .from("payment_submissions")
    .select("id")
    .eq("payment_id", id);

  if (
    submissionLoadError &&
    !/column .* does not exist/i.test(submissionLoadError.message)
  ) {
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
        error: `Payment is voided, but the linked UTR could not be reset: ${submissionUpdateError.message}`,
      };
    }
    submissionReset = linkedSubmissions.length;
  }

  return {
    ok: true,
    paymentId: id,
    receiptNumber,
    submissionReset,
  };
}
