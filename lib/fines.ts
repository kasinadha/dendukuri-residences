import type { SupabaseClient } from "@supabase/supabase-js";

export const WASTE_DUMPING_KIND = "waste_dumping" as const;

export type TenantFine = {
  id: string;
  tenancyId: string;
  tenantName: string;
  flatNumber: string;
  kind: typeof WASTE_DUMPING_KIND;
  offenseNumber: number;
  amount: number;
  billingMonth: string;
  notes: string | null;
  createdAt: string;
};

/** 1st ₹500, 2nd ₹750, 3rd ₹1000, then +₹250 each time. */
export function wasteDumpingFineAmount(offenseNumber: number): number {
  const n = Math.max(1, Math.floor(offenseNumber));
  if (n === 1) return 500;
  if (n === 2) return 750;
  return 1000 + (n - 3) * 250;
}

export function currentBillingMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadFinesDueByTenancy(
  supabase: SupabaseClient,
  billingMonthKey: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("tenant_fines")
    .select("tenancy_id, amount")
    .eq("billing_month", billingMonthKey);

  if (error || !data) return new Map();

  const map = new Map<string, number>();
  for (const row of data) {
    const id = String(row.tenancy_id);
    map.set(id, (map.get(id) ?? 0) + num(row.amount));
  }
  return map;
}

export async function listTenantFines(
  supabase: SupabaseClient,
  options?: { tenancyId?: string; limit?: number }
): Promise<TenantFine[]> {
  let query = supabase
    .from("tenant_fines")
    .select(
      `
      id,
      tenancy_id,
      kind,
      offense_number,
      amount,
      billing_month,
      notes,
      created_at,
      tenancies (
        tenants ( full_name ),
        flats ( flat_number )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 80);

  if (options?.tenancyId) {
    query = query.eq("tenancy_id", options.tenancyId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const tenancy = unwrapOne(row.tenancies);
    const tenant = unwrapOne(tenancy?.tenants);
    const flat = unwrapOne(tenancy?.flats);
    return {
      id: row.id,
      tenancyId: row.tenancy_id,
      tenantName: tenant?.full_name?.trim() || "—",
      flatNumber: flat?.flat_number?.trim() || "—",
      kind: "waste_dumping" as const,
      offenseNumber: Number(row.offense_number) || 1,
      amount: num(row.amount),
      billingMonth: row.billing_month,
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

export async function recordWasteDumpingFine(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    notes?: string | null;
    createdBy: string;
    billingMonth?: string;
  }
): Promise<
  | { ok: true; id: string; amount: number; offenseNumber: number }
  | { ok: false; error: string }
> {
  const tenancyId = input.tenancyId.trim();
  if (!tenancyId) return { ok: false, error: "Select a tenancy." };

  const { count, error: countError } = await supabase
    .from("tenant_fines")
    .select("id", { count: "exact", head: true })
    .eq("tenancy_id", tenancyId)
    .eq("kind", WASTE_DUMPING_KIND);

  if (countError) return { ok: false, error: countError.message };

  const offenseNumber = (count ?? 0) + 1;
  const amount = wasteDumpingFineAmount(offenseNumber);
  const billingMonth = input.billingMonth?.trim() || currentBillingMonthKey();

  const { data, error } = await supabase
    .from("tenant_fines")
    .insert({
      tenancy_id: tenancyId,
      kind: WASTE_DUMPING_KIND,
      offense_number: offenseNumber,
      amount,
      billing_month: billingMonth,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not record the fine." };
  }

  return { ok: true, id: data.id, amount, offenseNumber };
}
