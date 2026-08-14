import type { SupabaseClient } from "@supabase/supabase-js";

export type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  notes: string | null;
  isActive: boolean;
};

export type WaterTanker = {
  id: string;
  deliveryDate: string;
  amount: number | null;
  vendorId: string | null;
  vendorName: string | null;
  paymentStatus: string | null;
  notes: string | null;
  createdAt: string;
};

export type VacateRequest = {
  id: string;
  tenancyId: string;
  status: string;
  reason: string | null;
  flatNumber: string | null;
  tenantName: string | null;
};

export async function listVendors(
  supabase: SupabaseClient
): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("id,name,phone,category,notes,is_active")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name?.trim() || "—",
    phone: row.phone,
    category: row.category,
    notes: row.notes,
    isActive: Boolean(row.is_active),
  }));
}

export async function createVendor(
  supabase: SupabaseClient,
  input: {
    name: string;
    phone?: string | null;
    category?: string | null;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.name.trim()) return { ok: false, error: "Vendor name is required." };

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      category: input.category?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create vendor." };
  }
  return { ok: true, id: data.id };
}

export async function listWaterTankers(
  supabase: SupabaseClient
): Promise<WaterTanker[]> {
  const { data, error } = await supabase
    .from("water_tankers")
    .select(
      `
      id,
      delivery_date,
      amount,
      vendor_id,
      notes,
      payment_status,
      created_at,
      vendors ( name )
    `
    )
    .order("delivery_date", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    const amount =
      row.amount == null ? null : Number(row.amount);
    return {
      id: row.id,
      deliveryDate: row.delivery_date,
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      vendorId: row.vendor_id,
      vendorName: vendor?.name?.trim() || null,
      paymentStatus: row.payment_status,
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

export async function createWaterTanker(
  supabase: SupabaseClient,
  input: {
    deliveryDate: string;
    amount?: number | null;
    vendorId?: string | null;
    paymentStatus?: string | null;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.deliveryDate) {
    return { ok: false, error: "Delivery date is required." };
  }

  const { data, error } = await supabase
    .from("water_tankers")
    .insert({
      delivery_date: input.deliveryDate,
      amount: input.amount ?? null,
      vendor_id: input.vendorId || null,
      payment_status: input.paymentStatus?.trim() || "pending",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save tanker order." };
  }
  return { ok: true, id: data.id };
}

export async function listVacateRequests(
  supabase: SupabaseClient,
  options?: { tenancyId?: string; limit?: number }
): Promise<VacateRequest[]> {
  let query = supabase
    .from("vacate_requests")
    .select(
      `
      id,
      tenancy_id,
      status,
      reason,
      tenancies (
        tenants ( full_name ),
        flats ( flat_number )
      )
    `
    )
    .limit(options?.limit ?? 50);

  if (options?.tenancyId) {
    query = query.eq("tenancy_id", options.tenancyId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const tenancy = Array.isArray(row.tenancies)
      ? row.tenancies[0]
      : row.tenancies;
    const tenant = tenancy?.tenants
      ? Array.isArray(tenancy.tenants)
        ? tenancy.tenants[0]
        : tenancy.tenants
      : null;
    const flat = tenancy?.flats
      ? Array.isArray(tenancy.flats)
        ? tenancy.flats[0]
        : tenancy.flats
      : null;

    return {
      id: row.id,
      tenancyId: row.tenancy_id,
      status: row.status?.trim() || "pending",
      reason: row.reason,
      flatNumber: flat?.flat_number?.trim() || null,
      tenantName: tenant?.full_name?.trim() || null,
    };
  });
}

export async function createVacateRequest(
  supabase: SupabaseClient,
  input: { tenancyId: string; reason?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.tenancyId) return { ok: false, error: "No active tenancy." };

  const { data, error } = await supabase
    .from("vacate_requests")
    .insert({
      tenancy_id: input.tenancyId,
      status: "pending",
      reason: input.reason?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not submit vacate request." };
  }
  return { ok: true, id: data.id };
}

export async function updateVacateStatus(
  supabase: SupabaseClient,
  id: string,
  status: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("vacate_requests")
    .update({ status: status.trim() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
