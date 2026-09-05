import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyDatabaseError, isMissingColumnError } from "@/lib/money";

type FlatPaymentFields = {
  id?: string;
  flat_number: string | null;
  upi_id: string | null;
  upi_qr_url: string | null;
  payment_account_id?: string | null;
};

export type TenancyForPayment = {
  id: string;
  status: string | null;
  monthly_rent: number | string | null;
  flats: FlatPaymentFields | FlatPaymentFields[] | null;
};

const OPTIONAL_PAYMENT_COLUMNS = [
  "receiver_account_id",
  "billing_month",
  "parent_payment_id",
] as const;

/** Load tenancy for recording payment; tolerates missing payment_account_id column. */
export async function fetchTenancyForPayment(
  supabase: SupabaseClient,
  tenancyId: string
): Promise<
  | { ok: true; tenancy: TenancyForPayment }
  | { ok: false; error: string }
> {
  const full = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      flats ( id, flat_number, upi_id, upi_qr_url, payment_account_id )
    `
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (!full.error && full.data) {
    return { ok: true, tenancy: full.data as TenancyForPayment };
  }

  if (full.error && isMissingColumnError(full.error.message)) {
    const fallback = await supabase
      .from("tenancies")
      .select(
        `
        id,
        status,
        monthly_rent,
        flats ( id, flat_number, upi_id, upi_qr_url )
      `
      )
      .eq("id", tenancyId)
      .maybeSingle();

    if (!fallback.error && fallback.data) {
      return { ok: true, tenancy: fallback.data as TenancyForPayment };
    }

    return {
      ok: false,
      error:
        fallback.error?.message ??
        "Tenancy lookup failed. Run supabase/migrations/20260829_building_revenue_accounts.sql if account columns are missing.",
    };
  }

  if (full.error) {
    return { ok: false, error: full.error.message };
  }

  return { ok: false, error: "Tenancy not found." };
}

/** Insert payment; retries without receiver_account_id if that column is missing. */
export async function insertPaymentRecord(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; paymentId: string }
  | { ok: false; error: string }
> {
  let nextPayload: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < OPTIONAL_PAYMENT_COLUMNS.length + 1; attempt += 1) {
    const result = await supabase
      .from("payments")
      .insert(nextPayload)
      .select("id")
      .single();

    if (!result.error && result.data?.id) {
      return { ok: true, paymentId: result.data.id };
    }

    const msg = result.error?.message ?? "Could not record payment.";

    if (/amount_due/i.test(msg) && isMissingColumnError(msg)) {
      return {
        ok: false,
        error:
          "Database needs Phase 11 migration. Run supabase/migrations/20260815_phase11_rent_payment_receipts.sql",
      };
    }

    const missingOptional = OPTIONAL_PAYMENT_COLUMNS.find(
      (column) =>
        nextPayload[column] !== undefined &&
        isMissingColumnError(msg) &&
        new RegExp(column, "i").test(msg)
    );
    if (missingOptional) {
      const { [missingOptional]: _omit, ...rest } = nextPayload;
      nextPayload = rest;
      continue;
    }

    if (isMissingColumnError(msg) && nextPayload.receiver_account_id !== undefined) {
      const { receiver_account_id: _omit, ...rest } = nextPayload;
      nextPayload = rest;
      continue;
    }

    return { ok: false, error: friendlyDatabaseError(msg) };
  }

  return { ok: false, error: "Could not record payment." };
}

export function unwrapFlat(
  flats: FlatPaymentFields | FlatPaymentFields[] | null | undefined
): FlatPaymentFields | null {
  if (!flats) return null;
  return Array.isArray(flats) ? flats[0] ?? null : flats;
}
