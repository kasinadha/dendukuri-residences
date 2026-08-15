import type { SupabaseClient } from "@supabase/supabase-js";
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
  startDate: string;
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

function isActiveTenancyStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "active" || value === "occupied" || value === "";
}

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { ok: false, error: "Start date must be YYYY-MM-DD." };
  }

  const status = (input.status ?? "active").trim() || "active";
  const notes = encodeSourceNote(input.source);
  const created = { flat: false, tenant: false, tenancy: false };

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
        status: isActiveTenancyStatus(status) ? "occupied" : "vacant",
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
    start_date: input.startDate,
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

  if (isActiveTenancyStatus(status)) {
    const flatUpdate: Record<string, unknown> = { status: "occupied" };
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
 * Idempotent seed for the first real record: flat D201.
 * Rent 10000, deposit 50000, source Poster.
 */
export async function ensureD201Seed(
  supabase: SupabaseClient
): Promise<EnsureD201Result> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const existingFlat = await findFlatByNumber(supabase, D201_FLAT_NUMBER);

  if (existingFlat) {
    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("id,tenant_id,status,monthly_rent,security_deposit")
      .eq("flat_id", existingFlat.id);

    const active =
      (tenancies ?? []).find((t) => isActiveTenancyStatus(t.status)) ??
      (tenancies ?? [])[0] ??
      null;

    if (active) {
      const rent = Number(active.monthly_rent);
      const deposit = Number(active.security_deposit);
      const needsUpdate =
        rent !== D201_MONTHLY_RENT || deposit !== D201_SECURITY_DEPOSIT;

      if (needsUpdate) {
        await supabase
          .from("tenancies")
          .update({
            monthly_rent: D201_MONTHLY_RENT,
            security_deposit: D201_SECURITY_DEPOSIT,
            status: "active",
          })
          .eq("id", active.id);
      }

      await supabase
        .from("flats")
        .update({
          status: "occupied",
          building: PROPERTY_NAME,
          notes: encodeSourceNote(D201_SOURCE),
        })
        .eq("id", existingFlat.id);

      return {
        ok: true,
        status: needsUpdate ? "updated" : "already_present",
        flatId: existingFlat.id,
        tenantId: active.tenant_id,
        tenancyId: active.id,
      };
    }

    // Flat exists but no tenancy — create tenant + tenancy.
    const created = await createTenancyLink(supabase, {
      flatId: existingFlat.id,
      tenantFullName: D201_TENANT_NAME,
      monthlyRent: D201_MONTHLY_RENT,
      securityDeposit: D201_SECURITY_DEPOSIT,
      source: D201_SOURCE,
      startDate: today,
      status: "active",
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
    startDate: today,
    status: "active",
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
