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
  let query = supabase
    .from("maintenance_requests")
    .select(
      `
      id,
      flat_id,
      title,
      description,
      status,
      priority,
      cost,
      category,
      created_at,
      flats ( flat_number )
    `
    )
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.flatId) {
    query = query.eq("flat_id", options.flatId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const flat = Array.isArray(row.flats) ? row.flats[0] : row.flats;
    return {
      id: row.id,
      flatId: row.flat_id,
      flatNumber: flat?.flat_number?.trim() || "—",
      title: row.title?.trim() || "—",
      description: row.description,
      status: row.status?.trim() || "open",
      priority: row.priority?.trim() || "normal",
      cost: num(row.cost),
      category: row.category,
      createdAt: row.created_at,
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
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.flatId) return { ok: false, error: "Select a flat." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      flat_id: input.flatId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: input.status?.trim() || "open",
      priority: input.priority?.trim() || "normal",
      cost: input.cost ?? null,
      category: input.category?.trim() || null,
    })
    .select("id")
    .single();

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
