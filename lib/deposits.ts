import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import { incrementTenancyDepositPaid } from "@/lib/tenants";

export type TenancyDepositRow = {
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  wing: BuildingWing;
  agreed: number;
  collected: number;
  returned: number;
  held: number;
  pending: number;
};

export type BuildingDepositRow = {
  wing: BuildingWing;
  label: string;
  agreed: number;
  collected: number;
  returned: number;
  held: number;
  outstanding: number;
  tenantCount: number;
  tenants: TenancyDepositRow[];
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadAdvancePaidByTenancy(
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("payments")
    .select("tenancy_id, amount_paid, payment_type, status")
    .eq("payment_type", "advance")
    .gt("amount_paid", 0);

  const byTenancy = new Map<string, number>();
  for (const row of data ?? []) {
    if ((row.status ?? "").toLowerCase() === "voided") continue;
    const tenancyId = String(row.tenancy_id ?? "");
    if (!tenancyId) continue;
    byTenancy.set(
      tenancyId,
      (byTenancy.get(tenancyId) ?? 0) + num(row.amount_paid)
    );
  }
  return byTenancy;
}

export async function loadDepositSummary(
  supabase: SupabaseClient
): Promise<{
  byBuilding: BuildingDepositRow[];
  tenants: TenancyDepositRow[];
  totalAgreed: number;
  totalCollected: number;
  totalReturned: number;
  totalHeld: number;
}> {
  const [tenancyResult, advanceByTenancy] = await Promise.all([
    supabase.from("tenancies").select(`
        id,
        deposit_amount,
        deposit_paid,
        deposit_returned,
        security_deposit,
        flats ( flat_number ),
        tenants ( full_name )
      `),
    loadAdvancePaidByTenancy(supabase),
  ]);

  const tenants: TenancyDepositRow[] = [];

  for (const row of tenancyResult.data ?? []) {
    const flat = unwrapOne(
      row.flats as { flat_number?: string } | { flat_number?: string }[] | null
    );
    const tenant = unwrapOne(
      row.tenants as { full_name?: string } | { full_name?: string }[] | null
    );
    const wing = buildingWingFromFlatNumber(flat?.flat_number ?? null);
    if (!wing) continue;

    const agreed =
      num(row.deposit_amount) > 0
        ? num(row.deposit_amount)
        : num(row.security_deposit);
    const paidField = num(row.deposit_paid);
    const paidPayments = advanceByTenancy.get(String(row.id)) ?? 0;
    const collected = Math.max(paidField, paidPayments);
    const returned = num(row.deposit_returned);
    const held = Math.max(0, collected - returned);
    const pending = Math.max(0, agreed - collected);

    if (agreed <= 0 && collected <= 0 && returned <= 0) continue;

    tenants.push({
      tenancyId: String(row.id),
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      wing,
      agreed,
      collected,
      returned,
      held,
      pending,
    });
  }

  tenants.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));

  const byBuilding: BuildingDepositRow[] = (["C", "D"] as BuildingWing[]).map(
    (wing) => {
      const wingTenants = tenants.filter((row) => row.wing === wing);
      const agreed = wingTenants.reduce((sum, row) => sum + row.agreed, 0);
      const collected = wingTenants.reduce(
        (sum, row) => sum + row.collected,
        0
      );
      const returned = wingTenants.reduce(
        (sum, row) => sum + row.returned,
        0
      );
      const held = wingTenants.reduce((sum, row) => sum + row.held, 0);
      return {
        wing,
        label: buildingWingLabel(wing),
        agreed,
        collected,
        returned,
        held,
        outstanding: Math.max(0, agreed - collected),
        tenantCount: wingTenants.length,
        tenants: wingTenants,
      };
    }
  );

  return {
    byBuilding,
    tenants,
    totalAgreed: tenants.reduce((sum, row) => sum + row.agreed, 0),
    totalCollected: tenants.reduce((sum, row) => sum + row.collected, 0),
    totalReturned: tenants.reduce((sum, row) => sum + row.returned, 0),
    totalHeld: tenants.reduce((sum, row) => sum + row.held, 0),
  };
}

/** Move a rent payment into deposit/advance tracking (e.g. mis-recorded D201 deposit). */
export async function reclassifyPaymentAsDeposit(
  supabase: SupabaseClient,
  paymentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = paymentId.trim();
  if (!id) return { ok: false, error: "Missing payment id." };

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, tenancy_id, amount_paid, payment_type, payment_date, notes, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !payment) {
    return { ok: false, error: error?.message || "Payment not found." };
  }

  const type = String(payment.payment_type ?? "rent").toLowerCase();
  if (type === "advance") {
    return { ok: false, error: "Payment is already recorded as a deposit." };
  }
  if (type !== "rent") {
    return {
      ok: false,
      error: "Only rent payments can be reclassified as deposit.",
    };
  }
  if ((payment.status ?? "").toLowerCase() === "voided") {
    return { ok: false, error: "Cannot reclassify a voided payment." };
  }

  const amount = num(payment.amount_paid);
  const tenancyId = String(payment.tenancy_id ?? "");
  if (!tenancyId || amount <= 0) {
    return { ok: false, error: "Payment has no tenancy or amount." };
  }

  const notes = String(payment.notes ?? "").replace(
    /dues_breakdown:\{[^}]+\}\n?/g,
    ""
  );
  const cleanedNotes = notes.trim();
  const nextNotes = cleanedNotes
    ? `${cleanedNotes}\nReclassified from rent to deposit.`
    : "Reclassified from rent to deposit.";

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      payment_type: "advance",
      notes: nextNotes,
    })
    .eq("id", id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const depositUpdate = await incrementTenancyDepositPaid(supabase, {
    tenancyId,
    amount,
    paymentDate: String(payment.payment_date ?? ""),
  });
  if (!depositUpdate.ok) {
    await supabase
      .from("payments")
      .update({ payment_type: "rent", notes: payment.notes })
      .eq("id", id);
    return { ok: false, error: depositUpdate.error };
  }

  return { ok: true };
}
