"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getMonthlyDuesSummary } from "@/lib/monthly-dues";
import {
  completeMoveRequest,
  createVendor,
  createWaterTanker,
  updateVacateStatus,
  updateWaterTankerPaymentStatus,
} from "@/lib/ops";
import { buildRentReminderMessage, markRentReminded } from "@/lib/reminders";
import { sendWhatsAppBusinessMessage } from "@/lib/whatsapp";

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
    payerAccountId: asString(formData, "payer_account_id") || null,
    notes: asString(formData, "notes") || null,
  });
  if (result.ok) revalidatePath("/admin/water");
  if (result.ok) revalidatePath("/admin/reports");
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
  if (!tenancyId || !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { ok: false as const, error: "Missing tenancy or billing month." };
  }

  const summary = await getMonthlyDuesSummary(supabase, billingMonth);
  const row = summary.rows.find((item) => item.tenancyId === tenancyId);
  if (!row) {
    return { ok: false as const, error: "Tenancy not found for this month." };
  }

  const { data: tenancyMeta } = await supabase
    .from("tenancies")
    .select("id, tenants ( phone )")
    .eq("id", tenancyId)
    .maybeSingle();

  const tenant = Array.isArray(tenancyMeta?.tenants)
    ? tenancyMeta?.tenants[0]
    : tenancyMeta?.tenants;
  const phone = tenant?.phone?.trim() || null;
  if (!phone) {
    return { ok: false as const, error: "Tenant has no mobile number on file." };
  }

  const message = buildRentReminderMessage(row);
  const sendResult = await sendWhatsAppBusinessMessage({
    toPhone: phone,
    body: message,
  });
  if (!sendResult.ok) return sendResult;

  const markResult = await markRentReminded(supabase, {
    tenancyId,
    billingMonth,
    remindedBy: user.id,
    channel: "whatsapp_api",
    notes: `wa_message_id:${sendResult.messageId}`,
  });

  if (!markResult.ok) return markResult;

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  return { ok: true as const, messageId: sendResult.messageId };
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
