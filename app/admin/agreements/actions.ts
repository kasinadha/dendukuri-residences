"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  approveTenancyAgreement,
  DEFAULT_AGREEMENT_BODY,
  DEFAULT_AGREEMENT_TITLE,
  generateDraftAgreementsForActiveTenancies,
  markAgreementReminded,
  publishAgreementTemplate,
  sendAgreementWhatsAppReminder,
} from "@/lib/agreements";
import { recordWasteDumpingFine } from "@/lib/fines";

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
  const result = await sendAgreementWhatsAppReminder(supabase, {
    agreementId: asString(formData, "id"),
    tenancyId: asString(formData, "tenancy_id"),
    remindedBy: user.id,
    channel: "whatsapp_api",
  });
  if (result.ok) revalidatePath("/admin/agreements");
  return result;
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
