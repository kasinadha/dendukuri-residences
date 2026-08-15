"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  approvePaymentSubmission,
  rejectPaymentSubmission,
} from "@/lib/payment-submissions";
import {
  encodeBillingMonthNote,
  insertReceiptWithUniqueNumber,
} from "@/lib/receipts";

export type RecordPaymentResult =
  | {
      ok: true;
      paymentId: string;
      receiptId: string;
      receiptNumber: string;
    }
  | { ok: false; error: string };

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function approvePaymentSubmissionAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await approvePaymentSubmission(supabase, {
    id: asString(formData, "id"),
    adminNotes: asString(formData, "admin_notes") || null,
    reviewedBy: user.id,
  });
  if (result.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/tenant/receipts");
    revalidatePath("/tenant/pay");
    revalidatePath("/tenant");
  }
  return result;
}

export async function rejectPaymentSubmissionAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await rejectPaymentSubmission(supabase, {
    id: asString(formData, "id"),
    adminNotes: asString(formData, "admin_notes") || null,
    reviewedBy: user.id,
  });
  if (result.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/tenant/pay");
    revalidatePath("/tenant");
  }
  return result;
}

export async function recordRentPayment(
  formData: FormData
): Promise<RecordPaymentResult> {
  const { supabase } = await requireAdmin();

  const tenancyId = asString(formData, "tenancy_id");
  const amountRaw = asString(formData, "amount_paid");
  const paymentDate = asString(formData, "payment_date");
  const paymentMode = asString(formData, "payment_mode");
  const billingMonth = asString(formData, "billing_month");
  const transactionReference = asString(formData, "transaction_reference");
  const notes = asString(formData, "notes");

  if (!tenancyId) return { ok: false, error: "Select a tenancy." };
  if (!paymentDate) return { ok: false, error: "Payment date is required." };
  if (!paymentMode) return { ok: false, error: "Payment method is required." };
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false, error: "Billing month must be a valid month." };
  }

  const amountPaid = Number(amountRaw);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return { ok: false, error: "Enter a valid rent amount." };
  }

  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id,status")
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenancyError || !tenancy) {
    return { ok: false, error: "Tenancy not found." };
  }

  const paymentPayload = {
    tenancy_id: tenancyId,
    payment_date: paymentDate,
    amount_paid: amountPaid,
    payment_mode: paymentMode,
    payment_type: "rent",
    transaction_reference: transactionReference || null,
    status: "paid",
    notes: encodeBillingMonthNote(billingMonth, notes || undefined),
  };

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert(paymentPayload)
    .select("id")
    .single();

  if (paymentError || !payment) {
    return {
      ok: false,
      error: paymentError?.message ?? "Could not record payment.",
    };
  }

  try {
    const receipt = await insertReceiptWithUniqueNumber(supabase, payment.id);

    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/tenant/receipts");

    return {
      ok: true,
      paymentId: payment.id,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
    };
  } catch (error) {
    // Compensating delete so we do not leave a payment without a receipt.
    await supabase.from("payments").delete().eq("id", payment.id);

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Payment saved but receipt creation failed; payment was rolled back.",
    };
  }
}
