"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  approvePaymentSubmission,
  rejectPaymentSubmission,
} from "@/lib/payment-submissions";
import { computePaymentStatus } from "@/lib/payment-status";
import { resolveReceiverAccountId } from "@/lib/payment-accounts";
import { buildingWingFromFlatNumber } from "@/lib/building-wing";
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
    receiverAccountId: asString(formData, "receiver_account_id") || null,
  });
  if (result.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/tenant/receipts");
    revalidatePath("/tenant/pay");
    revalidatePath("/tenant");
    revalidatePath("/pay");
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
  const amountDueRaw = asString(formData, "amount_due");
  const amountPaidRaw = asString(formData, "amount_paid");
  const paymentDate = asString(formData, "payment_date");
  const paymentMode = asString(formData, "payment_mode");
  const billingMonth = asString(formData, "billing_month");
  const transactionReference = asString(formData, "transaction_reference");
  const notes = asString(formData, "notes");
  const waived = asString(formData, "waived") === "1";
  const explicitReceiverAccountId =
    asString(formData, "receiver_account_id") || null;

  if (!tenancyId) return { ok: false, error: "Select a tenancy." };
  if (!paymentDate) return { ok: false, error: "Payment date is required." };
  if (!paymentMode) return { ok: false, error: "Payment method is required." };
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false, error: "Billing month must be a valid month." };
  }

  const amountDue = Number(amountDueRaw);
  const amountPaid = Number(amountPaidRaw);
  if (!Number.isFinite(amountDue) || amountDue < 0) {
    return { ok: false, error: "Enter a valid amount due." };
  }
  if (!waived && (!Number.isFinite(amountPaid) || amountPaid < 0)) {
    return { ok: false, error: "Enter a valid amount paid." };
  }
  if (!waived && amountPaid <= 0) {
    return { ok: false, error: "Amount paid must be greater than zero." };
  }

  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      flats ( flat_number, upi_id, upi_qr_url, payment_account_id )
    `
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenancyError || !tenancy) {
    return { ok: false, error: "Tenancy not found." };
  }

  if (!isActiveTenancyStatus(tenancy.status)) {
    return {
      ok: false,
      error:
        "Only ACTIVE tenancies can have rent recorded. Confirmed/reserved flats (e.g. D201 before move-in) are excluded.",
    };
  }

  const status = waived
    ? "waived"
    : computePaymentStatus(amountDue, amountPaid);

  const flat = Array.isArray(tenancy.flats) ? tenancy.flats[0] : tenancy.flats;
  const receiverAccountId = await resolveReceiverAccountId(supabase, {
    explicitAccountId: explicitReceiverAccountId,
    upiId: flat?.upi_id,
    upiQrUrl: flat?.upi_qr_url,
    flatPaymentAccountId: flat?.payment_account_id,
    buildingWing: buildingWingFromFlatNumber(flat?.flat_number),
  });

  const paymentPayload: Record<string, unknown> = {
    tenancy_id: tenancyId,
    payment_date: paymentDate,
    amount_paid: waived ? 0 : amountPaid,
    amount_due: amountDue,
    payment_mode: paymentMode,
    payment_type: "rent",
    transaction_reference: transactionReference || null,
    status,
    notes: encodeBillingMonthNote(billingMonth, notes || undefined),
  };

  if (receiverAccountId) {
    paymentPayload.receiver_account_id = receiverAccountId;
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert(paymentPayload)
    .select("id")
    .single();

  if (paymentError || !payment) {
    const msg = paymentError?.message ?? "Could not record payment.";
    if (/amount_due|column .* does not exist/i.test(msg)) {
      return {
        ok: false,
        error:
          "Database needs Phase 11 migration. Run supabase/migrations/20260815_phase11_rent_payment_receipts.sql",
      };
    }
    return { ok: false, error: msg };
  }

  // Receipt only when money was collected (or waived acknowledgement)
  if (!waived && amountPaid <= 0) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return {
      ok: true,
      paymentId: payment.id,
      receiptId: "",
      receiptNumber: "(no receipt — zero paid)",
    };
  }

  try {
    const receipt = await insertReceiptWithUniqueNumber(supabase, payment.id);

    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/tenant/receipts");

    return {
      ok: true,
      paymentId: payment.id,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
    };
  } catch (error) {
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
