"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createVendor,
  createWaterTanker,
  updateVacateStatus,
} from "@/lib/ops";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createVendorAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await createVendor(supabase, {
    name: asString(formData, "name"),
    phone: asString(formData, "phone") || null,
    category: asString(formData, "category") || null,
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) revalidatePath("/admin/vendors");
  return result;
}

export async function createWaterTankerAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const amountRaw = asString(formData, "amount");
  const result = await createWaterTanker(supabase, {
    deliveryDate: asString(formData, "delivery_date"),
    amount: amountRaw ? Number(amountRaw) : null,
    vendorId: asString(formData, "vendor_id") || null,
    paymentStatus: asString(formData, "payment_status") || "pending",
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) revalidatePath("/admin/water");
  return result;
}

export async function updateVacateStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData, "id");
  const status = asString(formData, "status");
  if (!id || !status) return { ok: false as const, error: "Missing fields." };
  const result = await updateVacateStatus(supabase, id, status);
  if (result.ok) {
    revalidatePath("/admin/reports");
    revalidatePath("/tenant");
  }
  return result;
}
