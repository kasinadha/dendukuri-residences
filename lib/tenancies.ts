import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { PROPERTY_NAME } from "@/lib/property";

export const D201_FLAT_NUMBER = "D201";
export const D201_MONTHLY_RENT = 10000;
export const D201_SECURITY_DEPOSIT = 50000;
export const D201_SOURCE = "Poster";
export const D201_TENANT_NAME = "D201 Tenant";

export type CreateTenancyInput = {
  flatId?: string;
  flatNumber?: string;
  flatType?: string | null;
  tenantId?: string;
  tenantFullName?: string;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  monthlyRent: number;
  securityDeposit: number;
  source?: string | null;
  /** YYYY-MM-DD, or omit/null when move-in is unknown (e.g. confirmed). */
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
};

export type CreateTenancyResult =
  | {
      ok: true;
      flatId: string;
      tenantId: string;
      tenancyId: string;
      created: { flat: boolean; tenant: boolean; tenancy: boolean };
    }
  | { ok: false; error: string };

function isConfirmedTenancyStatus(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "confirmed";
}

/** @deprecated Prefer `@/lib/occupancy` — kept for existing imports. */
export function occupancyLabel(occupied: boolean): "occupied" | "vacant" {
  return occupied ? "occupied" : "vacant";
}

export function encodeSourceNote(
  source: string | null | undefined,
  extra?: string | null
): string | null {
  const parts: string[] = [];
  const trimmedSource = source?.trim();
  if (trimmedSource) parts.push(`source:${trimmedSource}`);
  const trimmedExtra = extra?.trim();
  if (trimmedExtra) parts.push(trimmedExtra);
  return parts.length ? parts.join("\n") : null;
}

export function parseSourceFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  const match = notes.match(/(?:^|\n)\s*source:\s*(.+)\s*$/im);
  return match?.[1]?.trim() || null;
}

async function findFlatByNumber(
  supabase: SupabaseClient,
  flatNumber: string
): Promise<{ id: string; status: string | null; notes: string | null } | null> {
  const { data, error } = await supabase
    .from("flats")
    .select("id,status,notes")
    .eq("flat_number", flatNumber)
    .maybeSingle();

  if (error) return null;
  return data;
}

/**
 * Creates or reuses a tenant, flat, and active tenancy link.
 * Updates the flat status to occupied when the tenancy is active.
 */
export async function createTenancyLink(
  supabase: SupabaseClient,
  input: CreateTenancyInput
): Promise<CreateTenancyResult> {
  const monthlyRent = Number(input.monthlyRent);
  const securityDeposit = Number(input.securityDeposit);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
    return { ok: false, error: "Enter a valid monthly rent." };
  }
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
    return { ok: false, error: "Enter a valid security deposit." };
  }
  const status = (input.status ?? "active").trim() || "active";
  const startDate = input.startDate?.trim() || null;
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "Start date must be YYYY-MM-DD." };
  }
  if (!startDate && isActiveTenancyStatus(status)) {
    return { ok: false, error: "Start date is required for active tenancies." };
  }

  const notes = encodeSourceNote(input.source);
  const created = { flat: false, tenant: false, tenancy: false };

  function flatStatusForTenancy(tenancyStatus: string): string {
    if (isActiveTenancyStatus(tenancyStatus)) return "occupied";
    if (isConfirmedTenancyStatus(tenancyStatus)) return "reserved";
    return "vacant";
  }

  let flatId = input.flatId?.trim() || "";
  if (!flatId) {
    const flatNumber = input.flatNumber?.trim();
    if (!flatNumber) {
      return { ok: false, error: "Select or enter a flat number." };
    }

    const existing = await findFlatByNumber(supabase, flatNumber);
    if (existing) {
      flatId = existing.id;
    } else {
      const flatPayload: Record<string, unknown> = {
        flat_number: flatNumber,
        status: flatStatusForTenancy(status),
        notes,
        building: PROPERTY_NAME,
      };
      if (input.flatType?.trim()) {
        flatPayload.flat_type = input.flatType.trim();
      }

      const { data: flat, error: flatError } = await supabase
        .from("flats")
        .insert(flatPayload)
        .select("id")
        .single();

      if (flatError || !flat) {
        return {
          ok: false,
          error: flatError?.message ?? "Could not create flat.",
        };
      }
      flatId = flat.id;
      created.flat = true;
    }
  }

  let tenantId = input.tenantId?.trim() || "";
  if (!tenantId) {
    const fullName = input.tenantFullName?.trim();
    if (!fullName) {
      return { ok: false, error: "Tenant name is required." };
    }

    const tenantPayload = {
      full_name: fullName,
      email: input.tenantEmail?.trim() || null,
      phone: input.tenantPhone?.trim() || null,
      notes,
    };

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert(tenantPayload)
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return {
        ok: false,
        error: tenantError?.message ?? "Could not create tenant.",
      };
    }
    tenantId = tenant.id;
    created.tenant = true;
  }

  // Avoid duplicate active tenancy on the same flat.
  const { data: existingTenancies } = await supabase
    .from("tenancies")
    .select("id,status")
    .eq("flat_id", flatId);

  const activeExisting = (existingTenancies ?? []).find((row) =>
    isActiveTenancyStatus(row.status)
  );
  if (activeExisting) {
    return {
      ok: false,
      error: "This flat already has an active tenancy.",
    };
  }

  const tenancyPayload: Record<string, unknown> = {
    flat_id: flatId,
    tenant_id: tenantId,
    start_date: startDate,
    end_date: input.endDate?.trim() || null,
    monthly_rent: monthlyRent,
    security_deposit: securityDeposit,
    status,
  };

  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .insert(tenancyPayload)
    .select("id")
    .single();

  if (tenancyError || !tenancy) {
    return {
      ok: false,
      error: tenancyError?.message ?? "Could not create tenancy.",
    };
  }
  created.tenancy = true;

  if (isActiveTenancyStatus(status) || isConfirmedTenancyStatus(status)) {
    const flatUpdate: Record<string, unknown> = {
      status: flatStatusForTenancy(status),
    };
    if (notes) flatUpdate.notes = notes;
    await supabase.from("flats").update(flatUpdate).eq("id", flatId);
  }

  return {
    ok: true,
    flatId,
    tenantId,
    tenancyId: tenancy.id,
    created,
  };
}

export type EnsureD201Result =
  | {
      ok: true;
      status: "created" | "already_present" | "updated";
      flatId: string;
      tenantId: string;
      tenancyId: string;
    }
  | { ok: false; error: string };

/**
 * Idempotent seed for flat D201: confirmed reservation (not occupied).
 * Rent 10000, deposit 50000, source Poster. start_date stays NULL until move-in.
 */
export async function ensureD201Seed(
  supabase: SupabaseClient
): Promise<EnsureD201Result> {
  const existingFlat = await findFlatByNumber(supabase, D201_FLAT_NUMBER);

  if (existingFlat) {
    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("id,tenant_id,status,monthly_rent,security_deposit")
      .eq("flat_id", existingFlat.id);

    const current =
      (tenancies ?? []).find((t) => isActiveTenancyStatus(t.status)) ??
      (tenancies ?? []).find(
        (t) => (t.status ?? "").toLowerCase() === "confirmed"
      ) ??
      (tenancies ?? [])[0] ??
      null;

    if (current) {
      await supabase
        .from("tenancies")
        .update({
          monthly_rent: D201_MONTHLY_RENT,
          security_deposit: D201_SECURITY_DEPOSIT,
          status: "confirmed",
          start_date: null,
        })
        .eq("id", current.id);

      await supabase
        .from("flats")
        .update({
          status: "reserved",
          building: PROPERTY_NAME,
          notes: encodeSourceNote(D201_SOURCE),
        })
        .eq("id", existingFlat.id);

      return {
        ok: true,
        status: "updated",
        flatId: existingFlat.id,
        tenantId: current.tenant_id,
        tenancyId: current.id,
      };
    }

    const created = await createTenancyLink(supabase, {
      flatId: existingFlat.id,
      tenantFullName: D201_TENANT_NAME,
      monthlyRent: D201_MONTHLY_RENT,
      securityDeposit: D201_SECURITY_DEPOSIT,
      source: D201_SOURCE,
      startDate: null,
      status: "confirmed",
    });

    if (!created.ok) return created;
    return {
      ok: true,
      status: "created",
      flatId: created.flatId,
      tenantId: created.tenantId,
      tenancyId: created.tenancyId,
    };
  }

  const created = await createTenancyLink(supabase, {
    flatNumber: D201_FLAT_NUMBER,
    tenantFullName: D201_TENANT_NAME,
    monthlyRent: D201_MONTHLY_RENT,
    securityDeposit: D201_SECURITY_DEPOSIT,
    source: D201_SOURCE,
    startDate: null,
    status: "confirmed",
  });

  if (!created.ok) return created;
  return {
    ok: true,
    status: "created",
    flatId: created.flatId,
    tenantId: created.tenantId,
    tenancyId: created.tenancyId,
  };
}
