"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { getTenantMonthDue } from "@/lib/reminders";
import {
  appendDuesBreakdownToNotes,
  applyAdditionalPaymentToBreakdown,
} from "@/lib/dues-breakdown";
import {
  approvePaymentSubmission,
  rejectPaymentSubmission,
} from "@/lib/payment-submissions";
import { computePaymentStatus } from "@/lib/payment-status";
import { resolveReceiverAccountId } from "@/lib/payment-accounts";
import { buildingWingFromFlatNumber } from "@/lib/building-wing";
import {
  fetchTenancyForPayment,
  insertPaymentRecord,
  unwrapFlat,
} from "@/lib/payment-record";
import {
  encodeBillingMonthNote,
  insertReceiptWithUniqueNumber,
} from "@/lib/receipts";
import { voidPaymentRecord } from "@/lib/void-payment";
import { getTenancyDuesBreakdownWithArrears } from "@/lib/public-pay-dues";
import { incrementTenancyDepositPaid } from "@/lib/tenants";

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
  const amountRaw = asString(formData, "amount");
  const amount = amountRaw ? Number(amountRaw) : null;
  const result = await approvePaymentSubmission(supabase, {
    id: asString(formData, "id"),
    adminNotes: asString(formData, "admin_notes") || null,
    reviewedBy: user.id,
    receiverAccountId: asString(formData, "receiver_account_id") || null,
    amount:
      amount != null && Number.isFinite(amount) && amount > 0 ? amount : null,
  });
  if (result.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/tenants");
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

export async function fetchTenancyDuesBreakdownAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  const flatId = asString(formData, "flat_id");
  const billingMonth = asString(formData, "billing_month");

  if (!tenancyId || !flatId) {
    return { ok: false as const, error: "Select a tenancy." };
  }
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false as const, error: "Billing month is invalid." };
  }

  return getTenancyDuesBreakdownWithArrears(supabase, {
    tenancyId,
    flatId,
    billingMonthKey: billingMonth,
  });
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
  const paymentCategory = asString(formData, "payment_category") || "dues";
  const isDeposit = paymentCategory === "deposit";
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

  const tenancyResult = await fetchTenancyForPayment(supabase, tenancyId);
  if (!tenancyResult.ok) {
    return { ok: false, error: tenancyResult.error };
  }
  const { tenancy } = tenancyResult;

  if (!isActiveTenancyStatus(tenancy.status)) {
    const monthDue = await getTenantMonthDue(supabase, tenancyId, billingMonth);
    if (!monthDue || monthDue.outstanding <= 0) {
      return {
        ok: false,
        error:
          "This tenancy is closed and has no outstanding dues for the selected month.",
      };
    }
  }

  const status = waived
    ? "waived"
    : computePaymentStatus(amountDue, amountPaid);

  const flat = unwrapFlat(tenancy.flats);
  const duesBreakdown =
    !isDeposit && !waived
      ? await (async () => {
          const breakdownResult = await getTenancyDuesBreakdownWithArrears(
            supabase,
            {
              tenancyId,
              flatId: flat?.id ?? "",
              billingMonthKey: billingMonth,
            }
          );
          if (!breakdownResult.ok) return null;
          return applyAdditionalPaymentToBreakdown(
            breakdownResult.breakdown,
            amountPaid
          );
        })()
      : null;

  const receiverAccountId = await resolveReceiverAccountId(supabase, {
    explicitAccountId: explicitReceiverAccountId,
    upiId: flat?.upi_id,
    upiQrUrl: flat?.upi_qr_url,
    flatPaymentAccountId: flat?.payment_account_id ?? null,
    buildingWing: buildingWingFromFlatNumber(flat?.flat_number),
  });

  const paymentPayload: Record<string, unknown> = {
    tenancy_id: tenancyId,
    payment_date: paymentDate,
    amount_paid: waived ? 0 : amountPaid,
    amount_due: amountDue,
    payment_mode: paymentMode,
    payment_type: isDeposit ? "advance" : "rent",
    transaction_reference: transactionReference || null,
    status,
    notes: isDeposit
      ? encodeBillingMonthNote(
          billingMonth,
          [notes || null, "Deposit / advance payment"].filter(Boolean).join("\n") ||
            undefined
        )
      : appendDuesBreakdownToNotes(
          encodeBillingMonthNote(billingMonth, notes || undefined),
          duesBreakdown
        ),
  };

  if (receiverAccountId) {
    paymentPayload.receiver_account_id = receiverAccountId;
  }

  const paymentResult = await insertPaymentRecord(supabase, paymentPayload);
  if (!paymentResult.ok) {
    return { ok: false, error: paymentResult.error };
  }
  const paymentId = paymentResult.paymentId;

  if (isDeposit && !waived) {
    const depositUpdate = await incrementTenancyDepositPaid(supabase, {
      tenancyId,
      amount: amountPaid,
      paymentDate,
    });
    if (!depositUpdate.ok) {
      await supabase.from("payments").delete().eq("id", paymentId);
      return { ok: false, error: depositUpdate.error };
    }
  }

  // Receipt only when money was collected (or waived acknowledgement)
  if (!waived && amountPaid <= 0) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return {
      ok: true,
      paymentId,
      receiptId: "",
      receiptNumber: "(no receipt — zero paid)",
    };
  }

  try {
    const receipt = await insertReceiptWithUniqueNumber(supabase, paymentId);

    revalidatePath("/admin/payments");
    revalidatePath("/admin/receipts");
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/tenants");
    revalidatePath("/tenant/receipts");

    return {
      ok: true,
      paymentId,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
    };
  } catch (error) {
    await supabase.from("payments").delete().eq("id", paymentId);

    const detail =
      error instanceof Error ? error.message : "unknown receipt error";
    return {
      ok: false,
      error: `Receipt creation failed (${detail}). Payment was rolled back. If this persists, check receipts table RLS and run supabase/migrations/20260808_receipt_number_uniqueness.sql.`,
    };
  }
}

function revalidateAfterPaymentChange() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/receipts");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/tenants");
  revalidatePath("/tenant/receipts");
  revalidatePath("/tenant/pay");
  revalidatePath("/tenant");
}

export async function voidPaymentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const paymentId = asString(formData, "payment_id");
  const confirm = asString(formData, "confirm");

  if (confirm.toUpperCase() !== "VOID") {
    return { ok: false as const, error: 'Type VOID to confirm deletion.' };
  }
  if (!paymentId) {
    return { ok: false as const, error: "Missing payment id." };
  }

  const result = await voidPaymentRecord(supabase, paymentId);
  if (result.ok) {
    revalidateAfterPaymentChange();
  }
  return result;
}
