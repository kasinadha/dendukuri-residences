"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  completeMoveRequest,
  createVendor,
  createWaterTanker,
  updateVacateStatus,
  updateWaterTanker,
  updateWaterTankerPaymentStatus,
} from "@/lib/ops";
import {
  markRentReminded,
  sendAllUnpaidWhatsAppReminders,
  sendUnpaidRentWhatsAppReminder,
} from "@/lib/reminders";
import { parseExpenseBuildingWing } from "@/lib/expense-location";

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
  const buildingWing = parseExpenseBuildingWing(asString(formData, "building_wing"));
  const payerAccountId = asString(formData, "payer_account_id");
  if (!buildingWing) {
    return { ok: false as const, error: "Select which building this tanker is for." };
  }
  if (!payerAccountId) {
    return { ok: false as const, error: "Select who paid for this tanker." };
  }
  const result = await createWaterTanker(supabase, {
    deliveryDate: asString(formData, "delivery_date"),
    amount: amountRaw ? Number(amountRaw) : null,
    vendorId: asString(formData, "vendor_id") || null,
    paymentStatus: asString(formData, "payment_status") || "pending",
    buildingWing,
    flatId: asString(formData, "flat_id") || null,
    payerAccountId,
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) revalidatePath("/admin/water");
  if (result.ok) revalidatePath("/admin/reports");
  if (result.ok) revalidatePath("/admin/expenses");
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

export async function sendWhatsAppReminderAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const tenancyId = asString(formData, "tenancy_id");
  const billingMonth = asString(formData, "billing_month");
  const result = await sendUnpaidRentWhatsAppReminder(supabase, {
    tenancyId,
    billingMonth,
    remindedBy: user.id,
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
  }
  return result;
}

export async function sendAllUnpaidWhatsAppRemindersAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const billingMonth = asString(formData, "billing_month");
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false as const, error: "Missing billing month." };
  }

  const result = await sendAllUnpaidWhatsAppReminders(supabase, {
    billingMonth,
    remindedBy: user.id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
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
    revalidatePath("/admin/reports");
    revalidatePath("/admin/expenses");
  }
  return result;
}

export async function updateWaterTankerAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const amountRaw = asString(formData, "amount");
  const buildingWing = parseExpenseBuildingWing(asString(formData, "building_wing"));
  const payerAccountId = asString(formData, "payer_account_id");
  if (!buildingWing) {
    return { ok: false as const, error: "Select which building this tanker is for." };
  }
  if (!payerAccountId) {
    return { ok: false as const, error: "Select who paid for this tanker." };
  }
  const result = await updateWaterTanker(supabase, {
    id: asString(formData, "id"),
    deliveryDate: asString(formData, "delivery_date"),
    amount: amountRaw ? Number(amountRaw) : null,
    vendorId: asString(formData, "vendor_id") || null,
    paymentStatus: asString(formData, "payment_status") || "pending",
    buildingWing,
    flatId: asString(formData, "flat_id") || null,
    payerAccountId,
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/water");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/expenses");
  }
  return result;
}
