import type { SupabaseClient } from "@supabase/supabase-js";

type FlatPaymentFields = {
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

function isMissingColumnError(message: string | null | undefined): boolean {
  return Boolean(message && /column .* does not exist|could not find.*column/i.test(message));
}

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
      flats ( flat_number, upi_id, upi_qr_url, payment_account_id )
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
        flats ( flat_number, upi_id, upi_qr_url )
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
  const first = await supabase
    .from("payments")
    .insert(payload)
    .select("id")
    .single();

  if (!first.error && first.data?.id) {
    return { ok: true, paymentId: first.data.id };
  }

  const msg = first.error?.message ?? "Could not record payment.";

  if (
    payload.receiver_account_id != null &&
    isMissingColumnError(msg)
  ) {
    const { receiver_account_id: _omit, ...withoutReceiver } = payload;
    const retry = await supabase
      .from("payments")
      .insert(withoutReceiver)
      .select("id")
      .single();

    if (!retry.error && retry.data?.id) {
      return { ok: true, paymentId: retry.data.id };
    }

    const retryMsg = retry.error?.message ?? msg;
    if (/amount_due|column .* does not exist/i.test(retryMsg)) {
      return {
        ok: false,
        error:
          "Database needs Phase 11 migration. Run supabase/migrations/20260815_phase11_rent_payment_receipts.sql",
      };
    }
    return { ok: false, error: retryMsg };
  }

  if (/amount_due/i.test(msg) && isMissingColumnError(msg)) {
    return {
      ok: false,
      error:
        "Database needs Phase 11 migration. Run supabase/migrations/20260815_phase11_rent_payment_receipts.sql",
    };
  }

  if (/receiver_account_id/i.test(msg) && isMissingColumnError(msg)) {
    return {
      ok: false,
      error:
        "Database needs building revenue migration. Run supabase/migrations/20260829_building_revenue_accounts.sql",
    };
  }

  return { ok: false, error: msg };
}

export function unwrapFlat(
  flats: FlatPaymentFields | FlatPaymentFields[] | null | undefined
): FlatPaymentFields | null {
  if (!flats) return null;
  return Array.isArray(flats) ? flats[0] ?? null : flats;
}
