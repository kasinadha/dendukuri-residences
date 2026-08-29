import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  buildTenantMonthlyCharges,
  type TenantMonthlyCharges,
} from "@/lib/tenant-charges";

export type { TenantMonthlyCharges };

export type TenantListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  flatNumber: string | null;
  flatType: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
  depositPaid: number | null;
  depositPaidDate: string | null;
  monthlyCharges: TenantMonthlyCharges | null;
  tenancyStatus: string | null;
  hasActiveTenancy: boolean;
  tenancyId: string | null;
  profileId: string | null;
  hasPortalLogin: boolean;
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

type FlatJoin = {
  flat_number: string | null;
  flat_type: string | null;
  status: string | null;
  maintenance_amount: number | string | null;
};

type TenancyJoin = {
  id: string;
  status: string | null;
  monthly_rent: number | string | null;
  security_deposit: number | string | null;
  deposit_amount: number | string | null;
  deposit_paid: number | string | null;
  deposit_paid_date: string | null;
  maintenance_charge: number | string | null;
  car_parking_charge: number | string | null;
  washing_machine_charge: number | string | null;
  other_monthly_charge: number | string | null;
  other_charges_notes: string | null;
  flats: FlatJoin | FlatJoin[] | null;
};

type TenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
  tenancies: TenancyJoin | TenancyJoin[] | null;
};

export async function updateTenantProfile(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.tenantId) return { ok: false, error: "Tenant is required." };
  if (!input.fullName.trim()) {
    return { ok: false, error: "Full name is required." };
  }

  const { error: tenantError } = await supabase
    .from("tenants")
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .eq("id", input.tenantId);

  if (tenantError) {
    return { ok: false, error: tenantError.message };
  }

  return { ok: true };
}

export async function updateTenantTenancyTerms(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    monthlyRent: number | null;
    depositAmount: number | null;
    depositPaid: number | null;
    depositPaidDate: string | null;
    maintenanceCharge: number | null;
    carParkingCharge: number | null;
    washingMachineCharge: number | null;
    otherMonthlyCharge: number | null;
    otherChargesNotes: string | null;
    termsConfirmed: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.tenancyId) return { ok: false, error: "Missing tenancy." };
  if (!input.termsConfirmed) {
    return {
      ok: false,
      error: "Confirm that tenancy term changes are intentional.",
    };
  }

  if (input.monthlyRent != null) {
    if (!Number.isFinite(input.monthlyRent) || input.monthlyRent < 0) {
      return { ok: false, error: "Enter a valid monthly rent." };
    }
  }

  if (input.depositAmount != null) {
    if (!Number.isFinite(input.depositAmount) || input.depositAmount < 0) {
      return { ok: false, error: "Enter a valid advance agreed amount." };
    }
  }

  if (input.depositPaid != null) {
    if (!Number.isFinite(input.depositPaid) || input.depositPaid < 0) {
      return { ok: false, error: "Enter a valid advance paid amount." };
    }
  }

  for (const [label, value] of [
    ["Maintenance", input.maintenanceCharge],
    ["Car parking", input.carParkingCharge],
    ["Washing machine", input.washingMachineCharge],
    ["Other charges", input.otherMonthlyCharge],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      return { ok: false, error: `Enter a valid ${label.toLowerCase()} amount.` };
    }
  }

  const payload: Record<string, unknown> = {
    monthly_rent: input.monthlyRent,
    deposit_amount: input.depositAmount,
    security_deposit: input.depositAmount,
    deposit_paid: input.depositPaid,
    deposit_paid_date: input.depositPaidDate || null,
    maintenance_charge: input.maintenanceCharge ?? 0,
    car_parking_charge: input.carParkingCharge ?? 0,
    washing_machine_charge: input.washingMachineCharge ?? 0,
    other_monthly_charge: input.otherMonthlyCharge ?? 0,
    other_charges_notes: input.otherChargesNotes?.trim() || null,
  };

  const { error: tenancyError } = await supabase
    .from("tenancies")
    .update(payload)
    .eq("id", input.tenancyId);

  if (tenancyError) {
    if (/maintenance_charge|car_parking_charge|washing_machine_charge|other_monthly_charge/i.test(
      tenancyError.message
    )) {
      return {
        ok: false,
        error:
          "Monthly charge columns are missing. Run supabase/migrations/20260829_tenancy_monthly_charges.sql in Supabase.",
      };
    }
    return { ok: false, error: tenancyError.message };
  }

  return { ok: true };
}

export async function listTenantsForAdmin(
  supabase: SupabaseClient
): Promise<TenantListItem[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      profile_id,
      tenancies (
        id,
        status,
        monthly_rent,
        security_deposit,
        deposit_amount,
        deposit_paid,
        deposit_paid_date,
        maintenance_charge,
        car_parking_charge,
        washing_machine_charge,
        other_monthly_charge,
        other_charges_notes,
        flats ( flat_number, flat_type, status, maintenance_amount )
      )
    `
    )
    .order("full_name", { ascending: true });

  if (error || !data) {
    const { data: fallback } = await supabase
      .from("tenants")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        profile_id,
        tenancies (
          id,
          status,
          monthly_rent,
          security_deposit,
          deposit_amount,
          deposit_paid,
          deposit_paid_date,
          flats ( flat_number, flat_type, status, maintenance_amount )
        )
      `
      )
      .order("full_name", { ascending: true });
    if (!fallback) return [];
    return mapTenantRows(fallback as unknown as TenantRow[], false);
  }

  return mapTenantRows(data as unknown as TenantRow[], true);
}

function mapTenantRows(
  data: TenantRow[],
  hasChargeColumns: boolean
): TenantListItem[] {
  return data.map((row) => {
    const tenancies = Array.isArray(row.tenancies)
      ? row.tenancies
      : row.tenancies
        ? [row.tenancies]
        : [];

    const activeTenancy =
      tenancies.find((t) => isActiveTenancyStatus(t.status)) ??
      tenancies[0] ??
      null;

    const flat = unwrapOne(activeTenancy?.flats ?? null);
    const rentRaw =
      activeTenancy?.monthly_rent == null
        ? null
        : Number(activeTenancy.monthly_rent);
    const monthlyRent =
      rentRaw != null && Number.isFinite(rentRaw) ? rentRaw : null;
    const depositAmount =
      num(activeTenancy?.deposit_amount) ??
      num(activeTenancy?.security_deposit);
    const hasActive = Boolean(
      activeTenancy && isActiveTenancyStatus(activeTenancy.status)
    );
    const monthlyCharges = hasActive
      ? buildTenantMonthlyCharges({
          maintenanceCharge: hasChargeColumns
            ? num(activeTenancy?.maintenance_charge)
            : null,
          carParkingCharge: hasChargeColumns
            ? num(activeTenancy?.car_parking_charge)
            : null,
          washingMachineCharge: hasChargeColumns
            ? num(activeTenancy?.washing_machine_charge)
            : null,
          otherMonthlyCharge: hasChargeColumns
            ? num(activeTenancy?.other_monthly_charge)
            : null,
          otherChargesNotes: hasChargeColumns
            ? activeTenancy?.other_charges_notes ?? null
            : null,
          flatMaintenanceFallback: num(flat?.maintenance_amount),
        })
      : null;

    return {
      id: row.id,
      fullName: row.full_name?.trim() || "—",
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      flatNumber: flat?.flat_number?.trim() || null,
      flatType: flat?.flat_type?.trim() || null,
      monthlyRent,
      depositAmount,
      depositPaid: num(activeTenancy?.deposit_paid),
      depositPaidDate: activeTenancy?.deposit_paid_date ?? null,
      monthlyCharges,
      tenancyStatus: activeTenancy?.status?.trim() || null,
      hasActiveTenancy: hasActive,
      tenancyId:
        activeTenancy && hasActive ? activeTenancy.id : null,
      profileId: row.profile_id ?? null,
      hasPortalLogin: Boolean(row.profile_id),
    };
  });
}
