import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyDatabaseError } from "@/lib/money";

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export type TenantChangeRequest = {
  id: string;
  tenantId: string;
  tenantName: string;
  field: "full_name";
  currentValue: string | null;
  requestedValue: string;
  status: ChangeRequestStatus;
  tenantNote: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type HelpNameCorrection =
  | { status: "guest" }
  | { status: "unlinked" }
  | {
      status: "ready";
      currentName: string;
      pending: TenantChangeRequest | null;
      latest: TenantChangeRequest | null;
    };

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listTenantChangeRequestsForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantChangeRequest[]> {
  const { data, error } = await supabase
    .from("tenant_change_requests")
    .select(
      `
      id,
      tenant_id,
      field,
      current_value,
      requested_value,
      status,
      tenant_note,
      admin_note,
      created_at,
      reviewed_at,
      tenants ( full_name )
    `
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map((row) => mapChangeRequest(row));
}

export async function getPendingNameChangeForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantChangeRequest | null> {
  const { data, error } = await supabase
    .from("tenant_change_requests")
    .select(
      `
      id,
      tenant_id,
      field,
      current_value,
      requested_value,
      status,
      tenant_note,
      admin_note,
      created_at,
      reviewed_at,
      tenants ( full_name )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("field", "full_name")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapChangeRequest(data);
}

export async function listPendingNameChangeRequests(
  supabase: SupabaseClient
): Promise<TenantChangeRequest[]> {
  const { data, error } = await supabase
    .from("tenant_change_requests")
    .select(
      `
      id,
      tenant_id,
      field,
      current_value,
      requested_value,
      status,
      tenant_note,
      admin_note,
      created_at,
      reviewed_at,
      tenants ( full_name )
    `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => mapChangeRequest(row));
}

export async function submitNameChangeRequest(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    currentValue: string | null;
    requestedValue: string;
    tenantNote?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const requested = input.requestedValue.trim();
  if (!input.tenantId) return { ok: false, error: "Missing tenant." };
  if (requested.length < 2) {
    return { ok: false, error: "Enter the name you want on records." };
  }
  if (
    requested.localeCompare(input.currentValue?.trim() ?? "", undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    return { ok: false, error: "That is already the name on file." };
  }

  const { data: existing } = await supabase
    .from("tenant_change_requests")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("field", "full_name")
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: false,
      error: "A name change is already waiting for owner approval.",
    };
  }

  const { data, error } = await supabase
    .from("tenant_change_requests")
    .insert({
      tenant_id: input.tenantId,
      field: "full_name",
      current_value: input.currentValue?.trim() || null,
      requested_value: requested,
      status: "pending",
      tenant_note: input.tenantNote?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: friendlyDatabaseError(
        error?.message ?? "Could not submit the request."
      ),
    };
  }
  return { ok: true, id: data.id };
}

export async function reviewNameChangeRequest(
  supabase: SupabaseClient,
  input: {
    id: string;
    decision: "approved" | "rejected";
    adminNote?: string | null;
    reviewedBy: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: loadError } = await supabase
    .from("tenant_change_requests")
    .select("id, tenant_id, requested_value, status")
    .eq("id", input.id)
    .maybeSingle();

  if (loadError || !row) {
    return { ok: false, error: loadError?.message ?? "Request not found." };
  }
  if (row.status !== "pending") {
    return { ok: false, error: "This request was already reviewed." };
  }

  if (input.decision === "approved") {
    const name = String(row.requested_value ?? "").trim();
    if (name.length < 2) {
      return { ok: false, error: "Requested name is invalid." };
    }

    const { data: tenant, error: tenantLoadError } = await supabase
      .from("tenants")
      .select("id, profile_id")
      .eq("id", row.tenant_id)
      .maybeSingle();

    if (tenantLoadError || !tenant) {
      return {
        ok: false,
        error: tenantLoadError?.message ?? "Tenant not found.",
      };
    }

    const { error: tenantError } = await supabase
      .from("tenants")
      .update({ full_name: name })
      .eq("id", tenant.id);
    if (tenantError) return { ok: false, error: tenantError.message };

    if (tenant.profile_id) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", tenant.profile_id);
      if (profileError) return { ok: false, error: profileError.message };
    }
  }

  const { error } = await supabase
    .from("tenant_change_requests")
    .update({
      status: input.decision,
      admin_note: input.adminNote?.trim() || null,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function mapChangeRequest(row: {
  id: string;
  tenant_id: string;
  field: string;
  current_value: string | null;
  requested_value: string;
  status: string;
  tenant_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  tenants?: { full_name: string | null } | { full_name: string | null }[] | null;
}): TenantChangeRequest {
  const tenant = unwrapOne(row.tenants);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: tenant?.full_name?.trim() || "Tenant",
    field: "full_name",
    currentValue: row.current_value,
    requestedValue: row.requested_value,
    status: (row.status as ChangeRequestStatus) || "pending",
    tenantNote: row.tenant_note,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}
