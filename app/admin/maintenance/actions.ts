"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createMaintenanceRequest,
  updateMaintenanceStatus,
} from "@/lib/maintenance";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMaintenanceAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const costRaw = asString(formData, "cost");
  const payerAccountId = asString(formData, "payer_account_id");
  if (!payerAccountId) {
    return { ok: false as const, error: "Select who paid for this maintenance." };
  }
  const result = await createMaintenanceRequest(supabase, {
    flatId: asString(formData, "flat_id"),
    title: asString(formData, "title"),
    description: asString(formData, "description") || null,
    status: asString(formData, "status") || "open",
    priority: asString(formData, "priority") || "normal",
    cost: costRaw ? Number(costRaw) : null,
    category: asString(formData, "category") || null,
    payerAccountId,
  });

  if (result.ok) {
    revalidatePath("/admin/maintenance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/expenses");
    revalidatePath("/tenant");
  }

  return result;
}

export async function updateMaintenanceStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData, "id");
  const status = asString(formData, "status");
  if (!id || !status) return { ok: false as const, error: "Missing fields." };

  const result = await updateMaintenanceStatus(supabase, id, status);
  if (result.ok) {
    revalidatePath("/admin/maintenance");
    revalidatePath("/tenant");
  }
  return result;
}
