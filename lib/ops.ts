import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXPENSE_LOCATION_MIGRATION_HINT,
  isMissingColumnError,
  PAYMENT_ACCOUNTS_MIGRATION_HINT,
} from "@/lib/db-errors";
import { endTenancy, transferTenancy } from "@/lib/tenancies";
import type { ExpenseBuildingWing } from "@/lib/expense-location";

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
  buildingWing: ExpenseBuildingWing | null;
  flatId: string | null;
  flatNumber: string | null;
  payerAccountId: string | null;
  payerAccountLabel: string | null;
  notes: string | null;
  createdAt: string;
};

export type MoveRequestType = "vacate" | "transfer";

export type VacateRequest = {
  id: string;
  tenancyId: string;
  status: string;
  requestType: MoveRequestType;
  reason: string | null;
  preferredFlatNumber: string | null;
  targetFlatId: string | null;
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

function mapWaterTankerRows(
  data: Array<Record<string, unknown>>
): WaterTanker[] {
  return data.map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    const payerAccount = Array.isArray(row.payment_accounts)
      ? row.payment_accounts[0]
      : row.payment_accounts;
    const flat = Array.isArray(row.flats) ? row.flats[0] : row.flats;
    const amount =
      row.amount == null ? null : Number(row.amount);
    const buildingWingRaw = String(row.building_wing ?? "").trim().toUpperCase();
    const buildingWing: ExpenseBuildingWing | null =
      buildingWingRaw === "C" || buildingWingRaw === "D"
        ? buildingWingRaw
        : buildingWingRaw === "SHARED"
          ? "shared"
          : null;
    return {
      id: String(row.id),
      deliveryDate: String(row.delivery_date),
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      vendorId: (row.vendor_id as string | null) ?? null,
      vendorName:
        vendor && typeof vendor === "object" && "name" in vendor
          ? String(vendor.name ?? "").trim() || null
          : null,
      paymentStatus: (row.payment_status as string | null) ?? null,
      buildingWing,
      flatId: (row.flat_id as string | null) ?? null,
      flatNumber:
        flat && typeof flat === "object" && "flat_number" in flat
          ? String(flat.flat_number ?? "").trim() || null
          : null,
      payerAccountId: (row.payer_account_id as string | null) ?? null,
      payerAccountLabel:
        payerAccount && typeof payerAccount === "object" && "label" in payerAccount
          ? String(payerAccount.label ?? "").trim() || null
          : null,
      notes: (row.notes as string | null) ?? null,
      createdAt: String(row.created_at),
    };
  });
}

export async function listWaterTankers(
  supabase: SupabaseClient
): Promise<WaterTanker[]> {
  const fullSelect = `
      id,
      delivery_date,
      amount,
      vendor_id,
      notes,
      payment_status,
      payer_account_id,
      building_wing,
      flat_id,
      created_at,
      vendors ( name ),
      payment_accounts ( label ),
      flats ( flat_number )
    `;

  const { data, error } = await supabase
    .from("water_tankers")
    .select(fullSelect)
    .order("delivery_date", { ascending: false })
    .limit(50);

  if (!error && data) {
    return mapWaterTankerRows(data as Array<Record<string, unknown>>);
  }

  if (error && isMissingColumnError(error.message)) {
    const fallback = await supabase
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

    if (!fallback.error && fallback.data) {
      return mapWaterTankerRows(fallback.data as Array<Record<string, unknown>>);
    }
  }

  return [];
}

export async function createWaterTanker(
  supabase: SupabaseClient,
  input: {
    deliveryDate: string;
    amount?: number | null;
    vendorId?: string | null;
    paymentStatus?: string | null;
    buildingWing: ExpenseBuildingWing;
    flatId?: string | null;
    payerAccountId: string;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.deliveryDate) {
    return { ok: false, error: "Delivery date is required." };
  }
  if (!input.buildingWing) {
    return { ok: false, error: "Select which building this tanker is for." };
  }
  if (!input.payerAccountId.trim()) {
    return { ok: false, error: "Select who paid for this tanker." };
  }

  const fullPayload = {
    delivery_date: input.deliveryDate,
    amount: input.amount ?? null,
    vendor_id: input.vendorId || null,
    payment_status: input.paymentStatus?.trim() || "pending",
    building_wing: input.buildingWing,
    flat_id: input.flatId || null,
    payer_account_id: input.payerAccountId,
    notes: input.notes?.trim() || null,
  };

  const first = await supabase
    .from("water_tankers")
    .insert(fullPayload)
    .select("id")
    .single();

  if (!first.error && first.data) {
    return { ok: true, id: first.data.id };
  }

  const msg = first.error?.message ?? "Could not save tanker order.";

  if (isMissingColumnError(msg)) {
    if (/building_wing|flat_id/i.test(msg)) {
      const { building_wing: _bw, flat_id: _fid, ...withoutLocation } = fullPayload;
      const retry = await supabase
        .from("water_tankers")
        .insert(withoutLocation)
        .select("id")
        .single();

      if (!retry.error && retry.data) {
        return { ok: true, id: retry.data.id };
      }

      const retryMsg = retry.error?.message ?? msg;
      if (isMissingColumnError(retryMsg) && /payer_account_id/i.test(retryMsg)) {
        const { payer_account_id: _pid, ...legacyPayload } = withoutLocation;
        const legacy = await supabase
          .from("water_tankers")
          .insert(legacyPayload)
          .select("id")
          .single();

        if (!legacy.error && legacy.data) {
          return { ok: true, id: legacy.data.id };
        }

        return {
          ok: false,
          error: `${legacy.error?.message ?? retryMsg} ${PAYMENT_ACCOUNTS_MIGRATION_HINT}`,
        };
      }

      return {
        ok: false,
        error: `${retryMsg} ${EXPENSE_LOCATION_MIGRATION_HINT}`,
      };
    }

    if (/payer_account_id/i.test(msg)) {
      const { payer_account_id: _pid, ...withoutPayer } = fullPayload;
      const retry = await supabase
        .from("water_tankers")
        .insert(withoutPayer)
        .select("id")
        .single();

      if (!retry.error && retry.data) {
        return { ok: true, id: retry.data.id };
      }

      return {
        ok: false,
        error: `${retry.error?.message ?? msg} ${PAYMENT_ACCOUNTS_MIGRATION_HINT}`,
      };
    }
  }

  return { ok: false, error: msg };
}

export async function updateWaterTankerPaymentStatus(
  supabase: SupabaseClient,
  id: string,
  paymentStatus: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id.trim()) return { ok: false, error: "Missing tanker id." };
  const status = paymentStatus.trim() || "pending";
  const { error } = await supabase
    .from("water_tankers")
    .update({ payment_status: status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateWaterTanker(
  supabase: SupabaseClient,
  input: {
    id: string;
    deliveryDate: string;
    amount?: number | null;
    vendorId?: string | null;
    paymentStatus?: string | null;
    buildingWing: ExpenseBuildingWing;
    flatId?: string | null;
    payerAccountId: string;
    notes?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id.trim()) return { ok: false, error: "Missing tanker id." };
  if (!input.deliveryDate) {
    return { ok: false, error: "Delivery date is required." };
  }
  if (!input.buildingWing) {
    return { ok: false, error: "Select which building this tanker is for." };
  }
  if (!input.payerAccountId.trim()) {
    return { ok: false, error: "Select who paid for this tanker." };
  }

  const payload = {
    delivery_date: input.deliveryDate,
    amount: input.amount ?? null,
    vendor_id: input.vendorId || null,
    payment_status: input.paymentStatus?.trim() || "pending",
    building_wing: input.buildingWing,
    flat_id: input.flatId || null,
    payer_account_id: input.payerAccountId,
    notes: input.notes?.trim() || null,
  };

  const first = await supabase
    .from("water_tankers")
    .update(payload)
    .eq("id", input.id);

  if (!first.error) return { ok: true };

  const msg = first.error.message;
  if (isMissingColumnError(msg)) {
    if (/building_wing|flat_id/i.test(msg)) {
      const { building_wing: _bw, flat_id: _fid, ...withoutLocation } = payload;
      const retry = await supabase
        .from("water_tankers")
        .update(withoutLocation)
        .eq("id", input.id);
      if (!retry.error) return { ok: true };
      return {
        ok: false,
        error: `${retry.error.message} ${EXPENSE_LOCATION_MIGRATION_HINT}`,
      };
    }
    if (/payer_account_id/i.test(msg)) {
      const { payer_account_id: _pid, ...withoutPayer } = payload;
      const retry = await supabase
        .from("water_tankers")
        .update(withoutPayer)
        .eq("id", input.id);
      if (!retry.error) return { ok: true };
      return {
        ok: false,
        error: `${retry.error.message} ${PAYMENT_ACCOUNTS_MIGRATION_HINT}`,
      };
    }
  }

  return { ok: false, error: msg };
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
      request_type,
      preferred_flat_number,
      target_flat_id,
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

  let { data, error } = await query;
  if (error) {
    let fallbackQuery = supabase
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
      fallbackQuery = fallbackQuery.eq("tenancy_id", options.tenancyId);
    }
    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }
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

    const extra = row as typeof row & {
      request_type?: string | null;
      preferred_flat_number?: string | null;
      target_flat_id?: string | null;
    };
    const requestType: MoveRequestType =
      extra.request_type === "transfer" ? "transfer" : "vacate";

    return {
      id: row.id,
      tenancyId: row.tenancy_id,
      status: row.status?.trim() || "pending",
      requestType,
      reason: row.reason,
      preferredFlatNumber: extra.preferred_flat_number?.trim() || null,
      targetFlatId: extra.target_flat_id ?? null,
      flatNumber: flat?.flat_number?.trim() || null,
      tenantName: tenant?.full_name?.trim() || null,
    };
  });
}

export async function createVacateRequest(
  supabase: SupabaseClient,
  input: {
    tenancyId: string;
    reason?: string | null;
    requestType?: MoveRequestType;
    preferredFlatNumber?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.tenancyId) return { ok: false, error: "No active tenancy." };

  const requestType: MoveRequestType =
    input.requestType === "transfer" ? "transfer" : "vacate";

  const payload: Record<string, unknown> = {
    tenancy_id: input.tenancyId,
    status: "pending",
    reason: input.reason?.trim() || null,
    request_type: requestType,
    preferred_flat_number: input.preferredFlatNumber?.trim() || null,
  };

  let { data, error } = await supabase
    .from("vacate_requests")
    .insert(payload)
    .select("id")
    .single();

  if (error && /column .* does not exist/i.test(error.message)) {
    const retry = await supabase
      .from("vacate_requests")
      .insert({
        tenancy_id: input.tenancyId,
        status: "pending",
        reason:
          [
            requestType === "transfer" ? "Transfer within" : "Move out",
            input.preferredFlatNumber?.trim()
              ? `preferred flat: ${input.preferredFlatNumber.trim()}`
              : null,
            input.reason?.trim(),
          ]
            .filter(Boolean)
            .join(" — ") || null,
      })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

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

export async function completeMoveRequest(
  supabase: SupabaseClient,
  input: {
    id: string;
    targetFlatId?: string | null;
    monthlyRent?: number | null;
    effectiveDate?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = input.id.trim();
  if (!id) return { ok: false, error: "Missing request." };

  let { data: row, error: loadError } = await supabase
    .from("vacate_requests")
    .select("id,tenancy_id,status,request_type")
    .eq("id", id)
    .maybeSingle();

  if (loadError && /column .* does not exist/i.test(loadError.message)) {
    const fallback = await supabase
      .from("vacate_requests")
      .select("id,tenancy_id,status")
      .eq("id", id)
      .maybeSingle();
    row = fallback.data
      ? { ...fallback.data, request_type: "vacate" }
      : fallback.data;
    loadError = fallback.error;
  }

  if (loadError || !row) {
    return { ok: false, error: loadError?.message ?? "Request not found." };
  }
  if (row.status === "completed") {
    return { ok: false, error: "This request is already completed." };
  }
  if (row.status === "rejected") {
    return { ok: false, error: "Rejected requests cannot be completed." };
  }

  const requestType: MoveRequestType =
    row.request_type === "transfer" ? "transfer" : "vacate";

  if (requestType === "transfer") {
    const targetFlatId = input.targetFlatId?.trim() || "";
    if (!targetFlatId) {
      return { ok: false, error: "Select the vacant flat for this transfer." };
    }
    const moved = await transferTenancy(supabase, {
      fromTenancyId: row.tenancy_id,
      toFlatId: targetFlatId,
      startDate: input.effectiveDate,
      monthlyRent: input.monthlyRent,
    });
    if (!moved.ok) return moved;

    const { error } = await supabase
      .from("vacate_requests")
      .update({
        status: "completed",
        target_flat_id: targetFlatId,
      })
      .eq("id", id);
    if (error && /column .* does not exist/i.test(error.message)) {
      const retry = await supabase
        .from("vacate_requests")
        .update({ status: "completed" })
        .eq("id", id);
      if (retry.error) return { ok: false, error: retry.error.message };
      return { ok: true };
    }
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const ended = await endTenancy(supabase, {
    tenancyId: row.tenancy_id,
    endDate: input.effectiveDate,
    status: "ended",
  });
  if (!ended.ok) return ended;

  const { error } = await supabase
    .from("vacate_requests")
    .update({ status: "completed" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
