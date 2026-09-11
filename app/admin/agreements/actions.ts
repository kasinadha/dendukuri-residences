"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  approveTenancyAgreement,
  buildAgreementReminderMessage,
  DEFAULT_AGREEMENT_BODY,
  DEFAULT_AGREEMENT_TITLE,
  generateDraftAgreementsForActiveTenancies,
  markAgreementReminded,
  publishAgreementTemplate,
} from "@/lib/agreements";
import { recordWasteDumpingFine } from "@/lib/fines";
import { sendWhatsAppBusinessMessage } from "@/lib/whatsapp";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateAgreements() {
  revalidatePath("/admin/agreements");
  revalidatePath("/admin/tenants");
  revalidatePath("/tenant");
  revalidatePath("/tenant/agreement");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
}

export async function publishAgreementTemplateAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await publishAgreementTemplate(supabase, {
    title: asString(formData, "title") || DEFAULT_AGREEMENT_TITLE,
    body: asString(formData, "body") || DEFAULT_AGREEMENT_BODY,
    createdBy: user.id,
  });
  if (result.ok) revalidateAgreements();
  return result;
}

export async function generateDraftAgreementsAction() {
  const { supabase } = await requireAdmin();
  const summary = await generateDraftAgreementsForActiveTenancies(supabase);
  revalidateAgreements();
  return { ok: true as const, ...summary };
}

export async function approveTenancyAgreementAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await approveTenancyAgreement(supabase, {
    id: asString(formData, "id"),
    approvedBy: user.id,
  });
  if (result.ok) revalidateAgreements();
  return result;
}

export async function markAgreementRemindedAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await markAgreementReminded(supabase, {
    agreementId: asString(formData, "id"),
    tenancyId: asString(formData, "tenancy_id"),
    remindedBy: user.id,
    channel: asString(formData, "channel") || "manual",
  });
  if (result.ok) revalidatePath("/admin/agreements");
  return result;
}

export async function sendAgreementWhatsAppReminderAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const agreementId = asString(formData, "id");
  const tenancyId = asString(formData, "tenancy_id");
  if (!agreementId || !tenancyId) {
    return { ok: false as const, error: "Missing agreement." };
  }

  const { data, error } = await supabase
    .from("tenancy_agreements")
    .select(
      `
      id,
      tenancy_id,
      flat_number,
      tenant_name,
      monthly_rent,
      tenancies ( tenants ( phone ) )
    `
    )
    .eq("id", agreementId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "Agreement not found." };
  }

  const tenancy = Array.isArray(data.tenancies) ? data.tenancies[0] : data.tenancies;
  const tenant = Array.isArray(tenancy?.tenants) ? tenancy?.tenants[0] : tenancy?.tenants;
  const phone = tenant?.phone?.trim() || null;
  if (!phone) {
    return { ok: false as const, error: "Tenant has no mobile number on file." };
  }

  const sendResult = await sendWhatsAppBusinessMessage({
    toPhone: phone,
    body: buildAgreementReminderMessage({
      tenantName: data.tenant_name?.trim() || "Tenant",
      flatNumber: data.flat_number?.trim() || "—",
      monthlyRent: Number(data.monthly_rent) || 0,
    }),
  });
  if (!sendResult.ok) return sendResult;

  const markResult = await markAgreementReminded(supabase, {
    agreementId,
    tenancyId,
    remindedBy: user.id,
    channel: "whatsapp_api",
    notes: `wa_message_id:${sendResult.messageId}`,
  });
  if (!markResult.ok) return markResult;
  revalidatePath("/admin/agreements");
  return { ok: true as const };
}

export async function recordWasteFineAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await recordWasteDumpingFine(supabase, {
    tenancyId: asString(formData, "tenancy_id"),
    notes: asString(formData, "notes") || null,
    createdBy: user.id,
  });
  if (result.ok) revalidateAgreements();
  return result;
}
