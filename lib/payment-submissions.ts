import type { SupabaseClient } from "@supabase/supabase-js";
import { buildingWingFromFlatNumber } from "@/lib/building-wing";
import { mapProofPathsToSignedUrls } from "@/lib/payment-proofs";
import { resolveReceiverAccountId } from "@/lib/payment-accounts";
import { insertPaymentRecord } from "@/lib/payment-record";
import { purposeLabel, type PaymentPurpose } from "@/lib/public-pay";
import {
  encodeBillingMonthNote,
  insertReceiptWithUniqueNumber,
} from "@/lib/receipts";

export type PaymentSubmission = {
  id: string;
  tenancyId: string | null;
  flatId: string | null;
  flatNumber: string;
  tenantName: string;
  payerName: string | null;
  payerPhone: string | null;
  purpose: PaymentPurpose;
  isPublicClaim: boolean;
  billingMonth: string | null;
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

function asPurpose(value: unknown): PaymentPurpose {
  const p = String(value ?? "rent").toLowerCase();
  if (p === "advance" || p === "maintenance") return p;
  return "rent";
}

export async function listPaymentSubmissions(
  supabase: SupabaseClient,
  options?: { status?: string; tenancyId?: string; limit?: number }
): Promise<PaymentSubmission[]> {
  const baseSelect = `
      id,
      tenancy_id,
      flat_id,
      purpose,
      payer_name,
      payer_phone,
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
      flats ( flat_number ),
      tenancies (
        flats ( flat_number ),
        tenants ( full_name )
      )
    `;

  const legacySelect = `
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

  async function run(select: string, withProof: boolean) {
    let query = supabase
      .from("payment_submissions")
      .select(withProof ? `${select},\n      proof_path` : select)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.status) query = query.eq("status", options.status);
    if (options?.tenancyId) query = query.eq("tenancy_id", options.tenancyId);
    return query;
  }

  let { data, error } = await run(baseSelect, true);
  if (error && /proof_path|flat_id|purpose|payer_name|flats/i.test(error.message)) {
    ({ data, error } = await run(baseSelect, false));
  }
  if (error && /flat_id|purpose|payer_name|flats/i.test(error.message)) {
    ({ data, error } = await run(legacySelect, true));
    if (error && /proof_path/i.test(error.message)) {
      ({ data, error } = await run(legacySelect, false));
    }
  }
  if (error || !data) return [];

  type Row = {
    id: string;
    tenancy_id: string | null;
    flat_id?: string | null;
    purpose?: string | null;
    payer_name?: string | null;
    payer_phone?: string | null;
    billing_month: string | null;
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
    flats?:
      | { flat_number: string }
      | { flat_number: string }[]
      | null;
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
    const flatFromTenancy = unwrapOne(tenancy?.flats ?? null);
    const flatDirect = unwrapOne(row.flats ?? null);
    const tenant = unwrapOne(tenancy?.tenants ?? null);
    const status = (row.status ?? "pending") as PaymentSubmission["status"];
    const proofPath = row.proof_path?.trim() || null;
    const purpose = asPurpose(row.purpose);
    const payerName = row.payer_name?.trim() || null;

    return {
      id: row.id,
      tenancyId: row.tenancy_id,
      flatId: row.flat_id ?? null,
      flatNumber:
        flatDirect?.flat_number?.trim() ||
        flatFromTenancy?.flat_number?.trim() ||
        "—",
      tenantName: tenant?.full_name?.trim() || payerName || "—",
      payerName,
      payerPhone: row.payer_phone?.trim() || null,
      purpose,
      isPublicClaim: Boolean(payerName) || !row.tenancy_id,
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
    flatId?: string | null;
    purpose?: PaymentPurpose;
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

  let flatId = input.flatId ?? null;
  if (!flatId) {
    const { data: tenancy } = await supabase
      .from("tenancies")
      .select("flat_id")
      .eq("id", input.tenancyId)
      .maybeSingle();
    flatId = tenancy?.flat_id ?? null;
  }

  const payload: Record<string, unknown> = {
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
  };

  if (flatId) payload.flat_id = flatId;
  payload.purpose = input.purpose ?? "rent";

  const { data, error } = await supabase
    .from("payment_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    const msg = error?.message ?? "";
    // Retry without newer columns if migration not applied yet
    if (/flat_id|purpose/i.test(msg)) {
      const { data: legacy, error: legacyError } = await supabase
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
      if (!legacyError && legacy) return { ok: true, id: legacy.id };
    }
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

async function resolveTenancyForSubmission(
  supabase: SupabaseClient,
  submission: {
    tenancy_id: string | null;
    flat_id: string | null;
  }
): Promise<string | null> {
  if (submission.tenancy_id) return submission.tenancy_id;
  if (!submission.flat_id) return null;

  const { data: active } = await supabase
    .from("tenancies")
    .select("id,status")
    .eq("flat_id", submission.flat_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!active?.length) return null;

  const preferred = active.find((t) => {
    const s = (t.status ?? "").toLowerCase();
    return s === "active" || s === "occupied" || s === "";
  });
  if (preferred) return preferred.id;

  const reserved = active.find(
    (t) => (t.status ?? "").toLowerCase() === "reserved"
  );
  return reserved?.id ?? active[0]?.id ?? null;
}

/**
 * Approves a pending UTR submission: creates paid payment + receipt when a
 * tenancy can be resolved. Public advance/maintenance claims without a tenancy
 * are marked approved without creating a receipt (admin can record later).
 */
export async function approvePaymentSubmission(
  supabase: SupabaseClient,
  input: {
    id: string;
    adminNotes?: string | null;
    reviewedBy: string;
    receiverAccountId?: string | null;
  }
): Promise<
  | {
      ok: true;
      paymentId: string | null;
      receiptId: string | null;
      receiptNumber: string | null;
      claimOnly?: boolean;
    }
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

  const purpose = asPurpose(submission.purpose);
  const tenancyId = await resolveTenancyForSubmission(supabase, {
    tenancy_id: submission.tenancy_id,
    flat_id: submission.flat_id ?? null,
  });

  // Rent always needs a tenancy for receipt posting.
  if (purpose === "rent" && !tenancyId) {
    return {
      ok: false,
      error:
        "No tenancy on this flat. Link or create a tenancy before approving rent, or reject the claim.",
    };
  }

  // Advance / maintenance without tenancy: acknowledge claim only.
  if (!tenancyId) {
    const { error: updateError } = await supabase
      .from("payment_submissions")
      .update({
        status: "approved",
        admin_notes:
          [
            input.adminNotes?.trim() || null,
            "Approved as claim only (no tenancy — no receipt created).",
          ]
            .filter(Boolean)
            .join("\n") || null,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("status", "pending");

    if (updateError) return { ok: false, error: updateError.message };
    return {
      ok: true,
      paymentId: null,
      receiptId: null,
      receiptNumber: null,
      claimOnly: true,
    };
  }

  const billingMonth =
    submission.billing_month ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    })
      .format(new Date())
      .slice(0, 7);

  let flatNumber: string | null = null;
  let flatUpiQrUrl: string | null = null;
  let flatPaymentAccountId: string | null = null;
  if (submission.flat_id) {
    let flatResult = await supabase
      .from("flats")
      .select("flat_number,upi_qr_url,payment_account_id")
      .eq("id", submission.flat_id)
      .maybeSingle();
    if (
      flatResult.error &&
      /column .* does not exist|could not find.*column/i.test(
        flatResult.error.message
      )
    ) {
      flatResult = await supabase
        .from("flats")
        .select("flat_number,upi_qr_url")
        .eq("id", submission.flat_id)
        .maybeSingle();
    }
    flatNumber = flatResult.data?.flat_number ?? null;
    flatUpiQrUrl = flatResult.data?.upi_qr_url ?? null;
    flatPaymentAccountId =
      (flatResult.data as { payment_account_id?: string | null } | null)
        ?.payment_account_id ?? null;
  } else if (tenancyId) {
    let tenancyResult = await supabase
      .from("tenancies")
      .select("flats(flat_number,upi_qr_url,payment_account_id)")
      .eq("id", tenancyId)
      .maybeSingle();
    if (
      tenancyResult.error &&
      /column .* does not exist|could not find.*column/i.test(
        tenancyResult.error.message
      )
    ) {
      tenancyResult = await supabase
        .from("tenancies")
        .select("flats(flat_number,upi_qr_url)")
        .eq("id", tenancyId)
        .maybeSingle();
    }
    const flat = Array.isArray(tenancyResult.data?.flats)
      ? tenancyResult.data?.flats[0]
      : tenancyResult.data?.flats;
    flatNumber = flat?.flat_number ?? null;
    flatUpiQrUrl = flat?.upi_qr_url ?? null;
    flatPaymentAccountId =
      (flat as { payment_account_id?: string | null } | null | undefined)
        ?.payment_account_id ?? null;
  }

  const receiverAccountId = await resolveReceiverAccountId(supabase, {
    explicitAccountId:
      input.receiverAccountId || submission.receiver_account_id || null,
    upiId: submission.upi_id,
    upiQrUrl: flatUpiQrUrl,
    flatPaymentAccountId,
    buildingWing: buildingWingFromFlatNumber(flatNumber),
  });

  const paymentPayload: Record<string, unknown> = {
    tenancy_id: tenancyId,
    payment_date: submission.payment_date,
    amount_paid: submission.amount,
    amount_due: submission.amount,
    payment_mode: "upi",
    payment_type: purpose,
    transaction_reference: submission.utr,
    status: "paid",
    notes: encodeBillingMonthNote(
      billingMonth,
      [
        `Approved from ${purposeLabel(purpose)} UTR submission`,
        submission.payer_name
          ? `Payer: ${submission.payer_name}${
              submission.payer_phone ? ` (${submission.payer_phone})` : ""
            }`
          : null,
        submission.notes ? `Notes: ${submission.notes}` : null,
        input.adminNotes ? `Admin notes: ${input.adminNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n") || undefined
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

  try {
    const receipt = await insertReceiptWithUniqueNumber(supabase, paymentId);

    const updatePayload: Record<string, unknown> = {
      status: "approved",
      payment_id: paymentId,
      tenancy_id: tenancyId,
      admin_notes: input.adminNotes?.trim() || null,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (receiverAccountId) {
      updatePayload.receiver_account_id = receiverAccountId;
    }

    let { error: updateError } = await supabase
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", input.id)
      .eq("status", "pending");

    if (
      updateError &&
      receiverAccountId &&
      /column .* does not exist|could not find.*column/i.test(updateError.message)
    ) {
      const { receiver_account_id: _omit, ...withoutReceiver } = updatePayload;
      const retry = await supabase
        .from("payment_submissions")
        .update(withoutReceiver)
        .eq("id", input.id)
        .eq("status", "pending");
      updateError = retry.error;
    }

    if (updateError) {
      return {
        ok: false,
        error: `Receipt ${receipt.receipt_number} was created, but submission update failed: ${updateError.message}`,
      };
    }

    return {
      ok: true,
      paymentId,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
    };
  } catch (err) {
    await supabase.from("payments").delete().eq("id", paymentId);
    const detail =
      err instanceof Error ? err.message : "unknown receipt error";
    return {
      ok: false,
      error: `Receipt creation failed (${detail}). Payment was rolled back.`,
    };
  }
}
