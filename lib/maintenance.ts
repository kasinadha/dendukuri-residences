import type { SupabaseClient } from "@supabase/supabase-js";

export type MaintenanceRequest = {
  id: string;
  flatId: string;
  flatNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  cost: number | null;
  category: string | null;
  payerAccountId: string | null;
  payerAccountLabel: string | null;
  createdAt: string;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listMaintenanceRequests(
  supabase: SupabaseClient,
  options?: { flatId?: string; limit?: number }
): Promise<MaintenanceRequest[]> {
  const columns = `
      id,
      flat_id,
      title,
      description,
      status,
      priority,
      cost,
      category,
      payer_account_id,
      created_at,
      flats ( flat_number )
  `;
  const withPayer = `${columns},
      payment_accounts ( label )
  `;

  async function run(select: string) {
    let query = supabase
      .from("maintenance_requests")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.flatId) {
      query = query.eq("flat_id", options.flatId);
    }
    return query;
  }

  let { data, error } = await run(withPayer);
  if (error) {
    const retry = await run(columns);
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) return [];

  return data.map((row) => {
    const rec = row as unknown as {
      id: string;
      flat_id: string;
      title: string | null;
      description: string | null;
      status: string | null;
      priority: string | null;
      cost: unknown;
      category: string | null;
      payer_account_id: string | null;
      created_at: string;
      flats?: { flat_number?: string } | { flat_number?: string }[] | null;
      payment_accounts?: { label?: string } | { label?: string }[] | null;
    };
    const flat = Array.isArray(rec.flats) ? rec.flats[0] : rec.flats;
    const payerAccount = Array.isArray(rec.payment_accounts)
      ? rec.payment_accounts[0]
      : rec.payment_accounts;
    return {
      id: rec.id,
      flatId: rec.flat_id,
      flatNumber: flat?.flat_number?.trim() || "—",
      title: rec.title?.trim() || "—",
      description: rec.description,
      status: rec.status?.trim() || "open",
      priority: rec.priority?.trim() || "normal",
      cost: num(rec.cost),
      category: rec.category,
      payerAccountId: rec.payer_account_id,
      payerAccountLabel: payerAccount?.label?.trim() || null,
      createdAt: rec.created_at,
    };
  });
}

export async function createMaintenanceRequest(
  supabase: SupabaseClient,
  input: {
    flatId: string;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    cost?: number | null;
    category?: string | null;
    payerAccountId?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.flatId) return { ok: false, error: "Select a flat." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (
    input.payerAccountId !== undefined &&
    !input.payerAccountId?.trim()
  ) {
    return { ok: false, error: "Select who paid for this expense." };
  }

  const payload: Record<string, unknown> = {
    flat_id: input.flatId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status?.trim() || "open",
    priority: input.priority?.trim() || "normal",
    cost: input.cost ?? null,
    category: input.category?.trim() || null,
  };
  if (input.payerAccountId !== undefined) {
    payload.payer_account_id = input.payerAccountId?.trim() || null;
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create request." };
  }

  return { ok: true, id: data.id };
}

export async function updateMaintenanceStatus(
  supabase: SupabaseClient,
  id: string,
  status: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status: status.trim() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
