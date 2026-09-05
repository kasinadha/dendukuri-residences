"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { getTenantMonthDue } from "@/lib/reminders";
import {
  appendDuesBreakdownToNotes,
  applyAdditionalPaymentToBreakdown,
  breakdownGrandOutstanding,
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
import { reclassifyPaymentAsDeposit } from "@/lib/deposits";
import { incrementTenancyDepositPaid } from "@/lib/tenants";
import {
  isValidBillingMonth,
  isValidIsoDate,
  parseRupeeAmount,
} from "@/lib/money";
import {
  allocationsFromPayment,
  findLivePaymentByUtr,
  insertPaymentAllocations,
} from "@/lib/payment-attribution";
import { formatActionError } from "@/lib/format-action-error";

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
  try {
    const amountRaw = asString(formData, "amount");
    const parsedAmount = amountRaw ? parseRupeeAmount(amountRaw) : null;
    const result = await approvePaymentSubmission(supabase, {
      id: asString(formData, "id"),
      adminNotes: asString(formData, "admin_notes") || null,
      reviewedBy: user.id,
      receiverAccountId: asString(formData, "receiver_account_id") || null,
      amount: parsedAmount,
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not approve this UTR. Try again."),
    };
  }
}

export async function rejectPaymentSubmissionAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  try {
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not reject this UTR. Try again."),
    };
  }
}

export async function fetchTenancyDuesBreakdownAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
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
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not load dues. Try again."),
    };
  }
}

export async function recordRentPayment(
  formData: FormData
): Promise<RecordPaymentResult> {
  const { supabase } = await requireAdmin();
  try {
    return await recordRentPaymentInner(supabase, formData);
  } catch (error) {
    return { ok: false, error: formatActionError(error, "Could not record payment.") };
  }
}

async function recordRentPaymentInner(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  formData: FormData
): Promise<RecordPaymentResult> {

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
  if (!isValidIsoDate(paymentDate)) {
    return { ok: false, error: "Payment date is required." };
  }
  if (!paymentMode) return { ok: false, error: "Payment method is required." };
  if (!isValidBillingMonth(billingMonth)) {
    return { ok: false, error: "Billing month must be a valid month." };
  }

  const amountDueInput = parseRupeeAmount(amountDueRaw, { allowZero: true });
  const amountPaidInput = waived
    ? 0
    : parseRupeeAmount(amountPaidRaw);
  if (amountDueInput == null) {
    return { ok: false, error: "Enter a valid amount due (0 or more)." };
  }
  if (!waived && amountPaidInput == null) {
    return { ok: false, error: "Amount paid must be greater than zero." };
  }
  const amountPaid = waived ? 0 : amountPaidInput ?? 0;

  if (transactionReference) {
    const existing = await findLivePaymentByUtr(supabase, transactionReference);
    if (existing) {
      return {
        ok: false,
        error:
          "This UTR / transaction reference is already recorded. Void the earlier payment first if this is a correction.",
      };
    }
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
    : computePaymentStatus(amountDueInput, amountPaid);

  const flat = unwrapFlat(tenancy.flats);
  const flatId = flat?.id;
  const baseBreakdown =
    !isDeposit && flatId
      ? await (async () => {
          const breakdownResult = await getTenancyDuesBreakdownWithArrears(
            supabase,
            {
              tenancyId,
              flatId,
              billingMonthKey: billingMonth,
            }
          );
          if (!breakdownResult.ok) return null;
          return breakdownResult.breakdown;
        })()
      : null;
  const duesBreakdown =
    baseBreakdown && !waived
      ? applyAdditionalPaymentToBreakdown(baseBreakdown, amountPaid)
      : null;
  const amountDue = baseBreakdown
    ? breakdownGrandOutstanding(baseBreakdown)
    : amountDueInput;
  const monthAllocations =
    baseBreakdown && !waived && !isDeposit
      ? allocationsFromPayment(baseBreakdown, amountPaid)
      : [];

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
    billing_month: billingMonth,
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

  if (monthAllocations.length > 0) {
    const allocated = await insertPaymentAllocations(
      supabase,
      paymentId,
      monthAllocations
    );
    if (!allocated.ok) {
      await supabase.from("payments").delete().eq("id", paymentId);
      return { ok: false, error: allocated.error };
    }
  }

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
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/tenants");
  revalidatePath("/tenant/receipts");
  revalidatePath("/tenant/pay");
  revalidatePath("/tenant");
}

export async function reclassifyPaymentAsDepositAction(paymentId: string) {
  const { supabase } = await requireAdmin();
  try {
    const result = await reclassifyPaymentAsDeposit(supabase, paymentId);
    if (result.ok) {
      revalidateAfterPaymentChange();
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not reclassify this payment."),
    };
  }
}

export async function voidPaymentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const paymentId = asString(formData, "payment_id");
    const confirm = asString(formData, "confirm");

    if (confirm.toUpperCase() !== "VOID") {
      return { ok: false as const, error: "Type VOID to confirm." };
    }
    if (!paymentId) {
      return { ok: false as const, error: "Missing payment id." };
    }

    const result = await voidPaymentRecord(supabase, paymentId);
    if (result.ok) {
      revalidateAfterPaymentChange();
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not void this payment. Try again."),
    };
  }
}
