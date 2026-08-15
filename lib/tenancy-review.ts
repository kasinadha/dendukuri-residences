import type { SupabaseClient } from "@supabase/supabase-js";

export type TenancyReviewItem = {
  id: string;
  flatNumber: string;
  tenantName: string;
  monthlyRent: number | null;
  depositAmount: number | null;
  depositPaid: number | null;
  depositPaidDate: string | null;
  startDate: string | null;
  notes: string | null;
  needsReview: boolean;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listTenanciesForReview(
  supabase: SupabaseClient
): Promise<TenancyReviewItem[]> {
  const { data, error } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      monthly_rent,
      security_deposit,
      deposit_amount,
      deposit_paid,
      deposit_paid_date,
      start_date,
      notes,
      status,
      flats ( flat_number ),
      tenants ( full_name )
    `
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    // Fallback if deposit columns not migrated yet
    const { data: fallback } = await supabase
      .from("tenancies")
      .select(
        `
        id,
        monthly_rent,
        security_deposit,
        start_date,
        status,
        flats ( flat_number ),
        tenants ( full_name )
      `
      )
      .order("created_at", { ascending: false });

    return (fallback ?? []).map((row) => {
      const flat = unwrapOne(
        row.flats as unknown as
          | { flat_number: string }
          | { flat_number: string }[]
          | null
      );
      const tenant = unwrapOne(
        row.tenants as unknown as
          | { full_name: string }
          | { full_name: string }[]
          | null
      );
      return {
        id: row.id,
        flatNumber: flat?.flat_number?.trim() || "—",
        tenantName: tenant?.full_name?.trim() || "—",
        monthlyRent: num(row.monthly_rent),
        depositAmount: num(row.security_deposit),
        depositPaid: null,
        depositPaidDate: null,
        startDate: row.start_date ?? null,
        notes: null,
        needsReview: true,
      };
    });
  }

  return data.map((row) => {
    const flat = unwrapOne(
      row.flats as unknown as
        | { flat_number: string }
        | { flat_number: string }[]
        | null
    );
    const tenant = unwrapOne(
      row.tenants as unknown as
        | { full_name: string }
        | { full_name: string }[]
        | null
    );
    const notes = (row.notes as string | null) ?? null;
    const depositAmount =
      num(row.deposit_amount) ?? num(row.security_deposit);
    const needsReview = Boolean(
      notes &&
        (/review|part-payment|not specified|raw:/i.test(notes) ||
          row.monthly_rent == null)
    );

    return {
      id: row.id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      monthlyRent: num(row.monthly_rent),
      depositAmount,
      depositPaid: num(row.deposit_paid),
      depositPaidDate: (row.deposit_paid_date as string | null) ?? null,
      startDate: (row.start_date as string | null) ?? null,
      notes,
      needsReview,
    };
  });
}

export async function updateTenancyReview(
  supabase: SupabaseClient,
  input: {
    id: string;
    monthlyRent: number | null;
    depositAmount: number | null;
    depositPaid: number | null;
    depositPaidDate: string | null;
    startDate: string | null;
    notes: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing tenancy id." };

  const { error } = await supabase
    .from("tenancies")
    .update({
      monthly_rent: input.monthlyRent,
      deposit_amount: input.depositAmount,
      security_deposit: input.depositAmount,
      deposit_paid: input.depositPaid,
      deposit_paid_date: input.depositPaidDate || null,
      start_date: input.startDate || null,
      notes: input.notes,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
