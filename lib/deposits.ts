import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import {
  isActiveTenancyStatus,
  isEndedTenancyStatus,
} from "@/lib/occupancy";
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

type RawTenancyRow = {
  id: string;
  status: string | null;
  start_date: string | null;
  deposit_amount: number | string | null;
  deposit_paid: number | string | null;
  deposit_returned: number | string | null;
  security_deposit: number | string | null;
  monthly_rent: number | string | null;
  flats:
    | { flat_number?: string }
    | { flat_number?: string }[]
    | null;
  tenants:
    | { full_name?: string }
    | { full_name?: string }[]
    | null;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function agreedDeposit(row: RawTenancyRow): number {
  return num(row.deposit_amount) > 0
    ? num(row.deposit_amount)
    : num(row.security_deposit);
}

function tenancyPriority(status: string | null | undefined): number {
  if (isActiveTenancyStatus(status)) return 0;
  if ((status ?? "").toLowerCase() === "confirmed") return 1;
  if (isEndedTenancyStatus(status)) return 3;
  return 2;
}

function pickCanonicalTenancy(rows: RawTenancyRow[]): RawTenancyRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const priority = tenancyPriority(a.status) - tenancyPriority(b.status);
    if (priority !== 0) return priority;
    return (b.start_date ?? "").localeCompare(a.start_date ?? "");
  })[0];
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

/** Rent payments that match the full agreed deposit (e.g. D201 ₹50,000 recorded as rent). */
function isLikelyMisclassifiedDepositPayment(input: {
  amount: number;
  agreed: number;
  monthlyRent: number;
}): boolean {
  if (input.agreed <= 0 || input.amount <= 0) return false;
  if (input.amount !== input.agreed) return false;
  if (input.monthlyRent > 0 && input.amount <= input.monthlyRent) return false;
  return true;
}

/**
 * Reclassify rent payments that clearly match the tenancy deposit amount.
 * Keeps monthly dues and deposit totals in sync without manual admin steps.
 */
export async function syncMisclassifiedDepositPayments(
  supabase: SupabaseClient
): Promise<void> {
  const { data: payments } = await supabase
    .from("payments")
    .select(
      `
      id,
      amount_paid,
      payment_type,
      status,
      tenancies (
        deposit_amount,
        security_deposit,
        monthly_rent,
        deposit_paid
      )
    `
    )
    .eq("payment_type", "rent")
    .gt("amount_paid", 0);

  for (const row of payments ?? []) {
    if ((row.status ?? "").toLowerCase() === "voided") continue;
    const tenancy = unwrapOne(
      row.tenancies as
        | {
            deposit_amount?: number | string | null;
            security_deposit?: number | string | null;
            monthly_rent?: number | string | null;
            deposit_paid?: number | string | null;
          }
        | {
            deposit_amount?: number | string | null;
            security_deposit?: number | string | null;
            monthly_rent?: number | string | null;
            deposit_paid?: number | string | null;
          }[]
        | null
    );
    if (!tenancy) continue;

    const agreed =
      num(tenancy.deposit_amount) > 0
        ? num(tenancy.deposit_amount)
        : num(tenancy.security_deposit);
    const amount = num(row.amount_paid);
    const monthlyRent = num(tenancy.monthly_rent);
    const alreadyPaid = num(tenancy.deposit_paid);

    if (
      !isLikelyMisclassifiedDepositPayment({
        amount,
        agreed,
        monthlyRent,
      })
    ) {
      continue;
    }
    if (alreadyPaid >= agreed) continue;

    await reclassifyPaymentAsDeposit(supabase, String(row.id));
  }
}

/** End placeholder / stale deposit rows when the flat has a newer canonical tenancy. */
async function vacateStaleDepositTenancies(
  supabase: SupabaseClient,
  grouped: Map<string, RawTenancyRow[]>
): Promise<void> {
  for (const [flatNumber, rows] of grouped) {
    if (rows.length < 2) continue;
    const canonical = pickCanonicalTenancy(rows);
    if (!canonical) continue;

    for (const row of rows) {
      if (row.id === canonical.id) continue;
      const agreed = agreedDeposit(row);
      if (agreed <= 0) continue;
      if (isEndedTenancyStatus(row.status)) continue;

      const tenant = unwrapOne(row.tenants);
      const name = tenant?.full_name?.trim() ?? "";
      const flatPrefix = flatNumber.split(/[^A-Za-z0-9]/)[0]?.toUpperCase() ?? "";
      const isPlaceholder =
        / tenant$/i.test(name) &&
        flatPrefix.length > 0 &&
        name.toUpperCase().startsWith(flatPrefix);
      const isStaleConfirmed =
        (row.status ?? "").toLowerCase() === "confirmed" &&
        tenancyPriority(canonical.status) < tenancyPriority(row.status);

      if (!isPlaceholder && !isStaleConfirmed) continue;

      await supabase
        .from("tenancies")
        .update({
          status: "cancelled",
          deposit_amount: 0,
          security_deposit: 0,
        })
        .eq("id", row.id);
    }
  }
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
  await syncMisclassifiedDepositPayments(supabase);

  const [tenancyResult, advanceByTenancy] = await Promise.all([
    supabase.from("tenancies").select(`
        id,
        status,
        start_date,
        deposit_amount,
        deposit_paid,
        deposit_returned,
        security_deposit,
        monthly_rent,
        flats ( flat_number ),
        tenants ( full_name )
      `),
    loadAdvancePaidByTenancy(supabase),
  ]);

  const byFlat = new Map<string, RawTenancyRow[]>();

  for (const row of (tenancyResult.data ?? []) as RawTenancyRow[]) {
    const flat = unwrapOne(row.flats);
    const flatNumber = flat?.flat_number?.trim();
    if (!flatNumber) continue;
    const wing = buildingWingFromFlatNumber(flatNumber);
    if (!wing) continue;

    const list = byFlat.get(flatNumber) ?? [];
    list.push(row);
    byFlat.set(flatNumber, list);
  }

  await vacateStaleDepositTenancies(supabase, byFlat);

  const tenants: TenancyDepositRow[] = [];

  for (const [flatNumber, rows] of byFlat) {
    const canonical = pickCanonicalTenancy(rows);
    if (!canonical) continue;

    const wing = buildingWingFromFlatNumber(flatNumber);
    if (!wing) continue;

    const tenant = unwrapOne(canonical.tenants);
    const agreed = agreedDeposit(canonical);
    const returned = num(canonical.deposit_returned);

    let collectedField = 0;
    let collectedPayments = 0;
    for (const row of rows) {
      if (isEndedTenancyStatus(row.status) && row.id !== canonical.id) {
        const rowAgreed = agreedDeposit(row);
        if (rowAgreed > 0 && tenancyPriority(row.status) >= 2) continue;
      }
      collectedField = Math.max(collectedField, num(row.deposit_paid));
      collectedPayments += advanceByTenancy.get(String(row.id)) ?? 0;
    }

    const collected = Math.max(collectedField, collectedPayments);
    const held = Math.max(0, collected - returned);
    const pending = Math.max(0, agreed - collected);

    if (agreed <= 0 && collected <= 0 && returned <= 0) continue;

    tenants.push({
      tenancyId: String(canonical.id),
      flatNumber,
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
    if (/payments_payment_type_check/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Database does not allow deposit payment type yet. Run supabase/migrations/20260902_payments_payment_type_advance.sql in Supabase, then try again.",
      };
    }
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
