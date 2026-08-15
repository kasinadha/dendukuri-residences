import type { SupabaseClient } from "@supabase/supabase-js";
import { mapProofPathsToSignedUrls } from "@/lib/payment-proofs";
import {
  encodeBillingMonthNote,
  insertReceiptWithUniqueNumber,
} from "@/lib/receipts";

export type PaymentSubmission = {
  id: string;
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  billingMonth: string;
  amount: number;
  paymentDate: string;
  utr: string;
  upiId: string | null;
  notes: string | null;
  proofPath: string | null;
  proofUrl: string | null;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  paymentId: string | null;
  createdAt: string;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listPaymentSubmissions(
  supabase: SupabaseClient,
  options?: { status?: string; tenancyId?: string; limit?: number }
): Promise<PaymentSubmission[]> {
  const baseSelect = `
      id,
      tenancy_id,
      billing_month,
      amount,
      payment_date,
      utr,
      upi_id,
      notes,
      status,
      admin_notes,
      payment_id,
      created_at,
      tenancies (
        flats ( flat_number ),
        tenants ( full_name )
      )
    `;

  async function run(withProof: boolean) {
    let query = supabase
      .from("payment_submissions")
      .select(withProof ? `${baseSelect},\n      proof_path` : baseSelect)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.status) query = query.eq("status", options.status);
    if (options?.tenancyId) query = query.eq("tenancy_id", options.tenancyId);
    return query;
  }

  let { data, error } = await run(true);
  if (error && /proof_path/i.test(error.message)) {
    ({ data, error } = await run(false));
  }
  if (error || !data) return [];

  type Row = {
    id: string;
    tenancy_id: string;
    billing_month: string;
    amount: number | string;
    payment_date: string;
    utr: string | null;
    upi_id: string | null;
    notes: string | null;
    proof_path?: string | null;
    status: string | null;
    admin_notes: string | null;
    payment_id: string | null;
    created_at: string;
    tenancies:
      | {
          flats: { flat_number: string } | { flat_number: string }[] | null;
          tenants: { full_name: string } | { full_name: string }[] | null;
        }
      | {
          flats: { flat_number: string } | { flat_number: string }[] | null;
          tenants: { full_name: string } | { full_name: string }[] | null;
        }[]
      | null;
  };

  const rows = data as unknown as Row[];
  const proofUrls = await mapProofPathsToSignedUrls(
    supabase,
    rows.map((row) => row.proof_path)
  );

  return rows.map((row) => {
    const tenancy = unwrapOne(row.tenancies);
    const flat = unwrapOne(tenancy?.flats ?? null);
    const tenant = unwrapOne(tenancy?.tenants ?? null);
    const status = (row.status ?? "pending") as PaymentSubmission["status"];
    const proofPath = row.proof_path?.trim() || null;

    return {
      id: row.id,
      tenancyId: row.tenancy_id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      billingMonth: row.billing_month,
      amount: num(row.amount),
      paymentDate: row.payment_date,
      utr: row.utr?.trim() || "",
      upiId: row.upi_id,
      notes: row.notes,
      proofPath,
      proofUrl: proofPath ? proofUrls.get(proofPath) ?? null : null,
      status,
      adminNotes: row.admin_notes,
      paymentId: row.payment_id,
      createdAt: row.created_at,
    };
  });
}

export async function createPaymentSubmission(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    billingMonth: string;
    amount: number;
    paymentDate: string;
    utr: string;
    upiId?: string | null;
    notes?: string | null;
    proofPath?: string | null;
    submittedBy: string;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}$/.test(input.billingMonth)) {
    return { ok: false, error: "Billing month is invalid." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  if (!input.utr.trim()) {
    return { ok: false, error: "UTR / transaction reference is required." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
    return { ok: false, error: "Payment date is required." };
  }

  const { data: existing } = await supabase
    .from("payment_submissions")
    .select("id")
    .eq("tenancy_id", input.tenancyId)
    .eq("billing_month", input.billingMonth)
    .eq("status", "pending")
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: "You already have a pending submission for this billing month.",
    };
  }

  const { data, error } = await supabase
    .from("payment_submissions")
    .insert({
      tenancy_id: input.tenancyId,
      billing_month: input.billingMonth,
      amount: input.amount,
      payment_date: input.paymentDate,
      utr: input.utr.trim(),
      upi_id: input.upiId?.trim() || null,
      notes: input.notes?.trim() || null,
      proof_path: input.proofPath?.trim() || null,
      status: "pending",
      submitted_by: input.submittedBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    const msg = error?.message ?? "";
    return {
      ok: false,
      error:
        msg.includes("proof_path")
          ? "Payment proof column is missing. Ask admin to run the payment-proofs migration."
          : msg ||
            "Could not submit payment. If this is the first time, ask admin to run the payment_submissions migration.",
    };
  }

  return { ok: true, id: data.id };
}

export async function rejectPaymentSubmission(
  supabase: SupabaseClient,
  input: { id: string; adminNotes?: string | null; reviewedBy: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("payment_submissions")
    .update({
      status: "rejected",
      admin_notes: input.adminNotes?.trim() || null,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Approves a pending UTR submission: creates paid payment + receipt, links them.
 */
export async function approvePaymentSubmission(
  supabase: SupabaseClient,
  input: { id: string; adminNotes?: string | null; reviewedBy: string }
): Promise<
  | { ok: true; paymentId: string; receiptId: string; receiptNumber: string }
  | { ok: false; error: string }
> {
  const { data: submission, error } = await supabase
    .from("payment_submissions")
    .select("*")
    .eq("id", input.id)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !submission) {
    return { ok: false, error: "Pending submission not found." };
  }

  const paymentPayload = {
    tenancy_id: submission.tenancy_id,
    payment_date: submission.payment_date,
    amount_paid: submission.amount,
    payment_mode: "upi",
    payment_type: "rent",
    transaction_reference: submission.utr,
    status: "paid",
    notes: encodeBillingMonthNote(
      submission.billing_month,
      [
        `Approved from tenant UTR submission`,
        submission.notes ? `Tenant notes: ${submission.notes}` : null,
        input.adminNotes ? `Admin notes: ${input.adminNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n") || undefined
    ),
  };

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert(paymentPayload)
    .select("id")
    .single();

  if (paymentError || !payment) {
    return {
      ok: false,
      error: paymentError?.message ?? "Could not create payment.",
    };
  }

  try {
    const receipt = await insertReceiptWithUniqueNumber(supabase, payment.id);

    const { error: updateError } = await supabase
      .from("payment_submissions")
      .update({
        status: "approved",
        payment_id: payment.id,
        admin_notes: input.adminNotes?.trim() || null,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("status", "pending");

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    return {
      ok: true,
      paymentId: payment.id,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
    };
  } catch (err) {
    await supabase.from("payments").delete().eq("id", payment.id);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Receipt creation failed; payment rolled back.",
    };
  }
}
