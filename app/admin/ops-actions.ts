"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  completeMoveRequest,
  createVendor,
  createWaterTanker,
  updateVacateStatus,
  updateWaterTankerPaymentStatus,
} from "@/lib/ops";
import { markRentReminded } from "@/lib/reminders";

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
    revalidatePath("/admin/tenants");
    revalidatePath("/admin/flats");
    revalidatePath("/tenant");
  }
  return result;
}

export async function completeMoveRequestAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const rentRaw = asString(formData, "monthly_rent");
  const result = await completeMoveRequest(supabase, {
    id: asString(formData, "id"),
    targetFlatId: asString(formData, "target_flat_id") || null,
    monthlyRent: rentRaw ? Number(rentRaw) : null,
    effectiveDate: asString(formData, "effective_date") || null,
  });
  if (result.ok) {
    revalidatePath("/admin/reports");
    revalidatePath("/admin/tenants");
    revalidatePath("/admin/flats");
    revalidatePath("/admin");
    revalidatePath("/tenant");
  }
  return result;
}

export async function markRentRemindedAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await markRentReminded(supabase, {
    tenancyId: asString(formData, "tenancy_id"),
    billingMonth: asString(formData, "billing_month"),
    remindedBy: user.id,
    channel: asString(formData, "channel") || "manual",
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
  }
  return result;
}

export async function updateWaterTankerPaymentStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await updateWaterTankerPaymentStatus(
    supabase,
    asString(formData, "id"),
    asString(formData, "payment_status") || "paid"
  );
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/water");
  }
  return result;
}
