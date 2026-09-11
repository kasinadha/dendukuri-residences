import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus, isEndedTenancyStatus } from "@/lib/occupancy";
import { tenantPhoneKey } from "@/lib/tenant-duplicates";
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
  depositReturned?: number | null;
  depositReturnedDate?: string | null;
  monthlyCharges: TenantMonthlyCharges | null;
  tenancyStatus: string | null;
  hasActiveTenancy: boolean;
  tenancyId: string | null;
  endedTenancyId: string | null;
  vacatedDate: string | null;
  lastFlatNumber: string | null;
  isArchived: boolean;
  profileId: string | null;
  hasPortalLogin: boolean;
  moveInDate: string | null;
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
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number | string | null;
  security_deposit: number | string | null;
  deposit_amount: number | string | null;
  deposit_paid: number | string | null;
  deposit_paid_date: string | null;
  deposit_returned?: number | string | null;
  deposit_returned_date?: string | null;
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
  archived_at: string | null;
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
    depositReturned: number | null;
    depositReturnedDate: string | null;
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

  if (input.depositReturned != null) {
    if (!Number.isFinite(input.depositReturned) || input.depositReturned < 0) {
      return { ok: false, error: "Enter a valid deposit returned amount." };
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
    deposit_returned: input.depositReturned ?? 0,
    deposit_returned_date: input.depositReturnedDate || null,
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

async function cancelDuplicateFlatTenancies(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: tenancies, error } = await supabase
    .from("tenancies")
    .select("id, flat_id, status")
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };

  const byFlat = new Map<
    string,
    { activeId: string | null; endedIds: string[] }
  >();

  for (const row of tenancies ?? []) {
    const flatId = row.flat_id as string;
    if (!flatId) continue;
    const entry = byFlat.get(flatId) ?? { activeId: null, endedIds: [] };
    if (isActiveTenancyStatus(row.status as string | null)) {
      entry.activeId = row.id as string;
    } else if (isEndedTenancyStatus(row.status as string | null)) {
      entry.endedIds.push(row.id as string);
    }
    byFlat.set(flatId, entry);
  }

  for (const { activeId, endedIds } of byFlat.values()) {
    if (!activeId || endedIds.length === 0) continue;

    for (const endedId of endedIds) {
      const { error: paymentMoveError } = await supabase
        .from("payments")
        .update({ tenancy_id: activeId })
        .eq("tenancy_id", endedId);

      if (paymentMoveError) {
        return { ok: false, error: paymentMoveError.message };
      }

      const { error: cancelError } = await supabase
        .from("tenancies")
        .update({ status: "cancelled" })
        .eq("id", endedId);

      if (cancelError) return { ok: false, error: cancelError.message };
    }
  }

  return { ok: true };
}

export async function mergeStaleTenantIntoCanonical(
  supabase: SupabaseClient,
  input: { staleTenantId: string; canonicalTenantId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staleTenantId = input.staleTenantId.trim();
  const canonicalTenantId = input.canonicalTenantId.trim();

  if (!staleTenantId || !canonicalTenantId) {
    return { ok: false, error: "Select both tenant records to merge." };
  }
  if (staleTenantId === canonicalTenantId) {
    return { ok: false, error: "Cannot merge a tenant into itself." };
  }

  const [{ data: stale }, { data: canonical }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, phone, profile_id, tenancies ( id, status )")
      .eq("id", staleTenantId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, phone, profile_id, tenancies ( id, status )")
      .eq("id", canonicalTenantId)
      .maybeSingle(),
  ]);

  if (!stale || !canonical) {
    return { ok: false, error: "Tenant record not found." };
  }

  const staleTenancies = Array.isArray(stale.tenancies)
    ? stale.tenancies
    : stale.tenancies
      ? [stale.tenancies]
      : [];
  const canonicalTenancies = Array.isArray(canonical.tenancies)
    ? canonical.tenancies
    : canonical.tenancies
      ? [canonical.tenancies]
      : [];

  if (staleTenancies.some((row) => isActiveTenancyStatus(row.status))) {
    return {
      ok: false,
      error: "Only a former tenant record can be merged away.",
    };
  }

  if (
    !canonicalTenancies.some((row) => isActiveTenancyStatus(row.status))
  ) {
    return {
      ok: false,
      error: "Merge into the active tenant record for this flat.",
    };
  }

  const stalePhone = tenantPhoneKey(stale.phone as string | null);
  const canonicalPhone = tenantPhoneKey(canonical.phone as string | null);
  if (!stalePhone || stalePhone !== canonicalPhone) {
    return {
      ok: false,
      error: "Both records must share the same mobile number.",
    };
  }

  const { error: moveError } = await supabase
    .from("tenancies")
    .update({ tenant_id: canonicalTenantId })
    .eq("tenant_id", staleTenantId);

  if (moveError) return { ok: false, error: moveError.message };

  const dedupe = await cancelDuplicateFlatTenancies(supabase, canonicalTenantId);
  if (!dedupe.ok) return dedupe;

  if (!canonical.profile_id && stale.profile_id) {
    const { error: profileError } = await supabase
      .from("tenants")
      .update({ profile_id: stale.profile_id })
      .eq("id", canonicalTenantId);

    if (profileError) return { ok: false, error: profileError.message };

    await supabase
      .from("tenants")
      .update({ profile_id: null })
      .eq("id", staleTenantId);
  }

  const archive = await archiveTenant(supabase, staleTenantId);
  if (!archive.ok) return archive;

  return { ok: true };
}

export async function archiveTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId.trim()) return { ok: false, error: "Tenant is required." };

  const { data: tenant, error: loadError } = await supabase
    .from("tenants")
    .select("id, tenancies ( status )")
    .eq("id", tenantId)
    .maybeSingle();

  if (loadError || !tenant) {
    return { ok: false, error: loadError?.message ?? "Tenant not found." };
  }

  const tenancies = Array.isArray(tenant.tenancies)
    ? tenant.tenancies
    : tenant.tenancies
      ? [tenant.tenancies]
      : [];

  if (tenancies.some((row) => isActiveTenancyStatus(row.status))) {
    return {
      ok: false,
      error: "Archive only former tenants with no active flat.",
    };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) {
    if (/archived_at/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Archive column is missing. Run supabase/migrations/20260830_tenant_archive.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function recordTenancyVacateDate(
  supabase: SupabaseClient,
  input: { tenancyId: string; endDate: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenancyId = input.tenancyId.trim();
  const endDate = input.endDate.trim();
  if (!tenancyId) return { ok: false, error: "Missing tenancy." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: "Vacate date must be YYYY-MM-DD." };
  }

  const { data: tenancy, error: loadError } = await supabase
    .from("tenancies")
    .select("id, status")
    .eq("id", tenancyId)
    .maybeSingle();

  if (loadError || !tenancy) {
    return { ok: false, error: loadError?.message ?? "Tenancy not found." };
  }

  if (!isEndedTenancyStatus(tenancy.status)) {
    return {
      ok: false,
      error: "Vacate date can only be set on ended tenancies.",
    };
  }

  const { error } = await supabase
    .from("tenancies")
    .update({ end_date: endDate })
    .eq("id", tenancyId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateTenancyMoveInDate(
  supabase: SupabaseClient,
  input: { tenancyId: string; startDate: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenancyId = input.tenancyId.trim();
  if (!tenancyId) return { ok: false, error: "Missing tenancy." };

  const startDate = input.startDate?.trim() || null;
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "Move-in date must be YYYY-MM-DD." };
  }

  const { data: tenancy, error: loadError } = await supabase
    .from("tenancies")
    .select("id, status")
    .eq("id", tenancyId)
    .maybeSingle();

  if (loadError || !tenancy) {
    return { ok: false, error: loadError?.message ?? "Tenancy not found." };
  }

  if (!isActiveTenancyStatus(tenancy.status)) {
    return {
      ok: false,
      error: "Move-in date can only be set on an active tenancy.",
    };
  }

  const { error } = await supabase
    .from("tenancies")
    .update({ start_date: startDate })
    .eq("id", tenancyId);

  if (error) return { ok: false, error: error.message };
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
      archived_at,
      tenancies (
        id,
        status,
        start_date,
        end_date,
        monthly_rent,
        security_deposit,
        deposit_amount,
        deposit_paid,
        deposit_paid_date,
        deposit_returned,
        deposit_returned_date,
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
          start_date,
          end_date,
          monthly_rent,
          security_deposit,
          deposit_amount,
          deposit_paid,
          deposit_paid_date,
          deposit_returned,
          deposit_returned_date,
          flats ( flat_number, flat_type, status, maintenance_amount )
        )
      `
      )
      .order("full_name", { ascending: true });
    if (!fallback) return [];
    return mapTenantRows(
      (fallback as unknown as TenantRow[]).map((row) => ({
        ...row,
        archived_at: null,
      })),
      false
    );
  }

  return mapTenantRows(data as unknown as TenantRow[], true);
}

function pickEndedTenancy(tenancies: TenancyJoin[]): TenancyJoin | null {
  const ended = tenancies
    .filter((row) => isEndedTenancyStatus(row.status))
    .sort((a, b) => {
      const endCompare = (b.end_date ?? "").localeCompare(a.end_date ?? "");
      if (endCompare !== 0) return endCompare;
      return (b.start_date ?? "").localeCompare(a.start_date ?? "");
    });
  return ended[0] ?? null;
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
      tenancies.find((t) => isActiveTenancyStatus(t.status)) ?? null;
    const endedTenancy = pickEndedTenancy(tenancies);
    const displayTenancy = activeTenancy ?? endedTenancy;

    const flat = unwrapOne(displayTenancy?.flats ?? null);
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

    const endedFlat = unwrapOne(endedTenancy?.flats ?? null);

    return {
      id: row.id,
      fullName: row.full_name?.trim() || "—",
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      flatNumber: hasActive
        ? flat?.flat_number?.trim() || null
        : endedFlat?.flat_number?.trim() || null,
      flatType: hasActive
        ? flat?.flat_type?.trim() || null
        : endedFlat?.flat_type?.trim() || null,
      monthlyRent,
      depositAmount,
      depositPaid: num(activeTenancy?.deposit_paid),
      depositPaidDate: activeTenancy?.deposit_paid_date ?? null,
      depositReturned: num(activeTenancy?.deposit_returned),
      depositReturnedDate: activeTenancy?.deposit_returned_date ?? null,
      monthlyCharges,
      tenancyStatus: displayTenancy?.status?.trim() || null,
      hasActiveTenancy: hasActive,
      tenancyId:
        activeTenancy && hasActive ? activeTenancy.id : null,
      endedTenancyId: endedTenancy?.id ?? null,
      vacatedDate: endedTenancy?.end_date ?? null,
      lastFlatNumber: endedFlat?.flat_number?.trim() || null,
      isArchived: Boolean(row.archived_at),
      profileId: row.profile_id ?? null,
      hasPortalLogin: Boolean(row.profile_id),
      moveInDate: activeTenancy?.start_date ?? null,
    };
  });
}

export async function incrementTenancyDepositPaid(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    amount: number;
    paymentDate: string;
  }
): Promise<{ ok: true; depositPaid: number } | { ok: false; error: string }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Invalid deposit amount." };
  }

  const { data, error } = await supabase
    .from("tenancies")
    .select("deposit_paid, deposit_amount, security_deposit")
    .eq("id", input.tenancyId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Tenancy not found." };
  }

  const nextPaid = (num(data.deposit_paid) ?? 0) + input.amount;
  const depositAmount =
    num(data.deposit_amount) ?? num(data.security_deposit) ?? null;
  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      deposit_paid: nextPaid,
      deposit_paid_date: input.paymentDate,
      ...(depositAmount != null
        ? { deposit_amount: depositAmount, security_deposit: depositAmount }
        : {}),
    })
    .eq("id", input.tenancyId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, depositPaid: nextPaid };
}
