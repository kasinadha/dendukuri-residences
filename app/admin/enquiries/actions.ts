"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  addEnquiryFollowup,
  ENQUIRY_STATUSES,
  type EnquiryStatus,
  updateEnquiryStatus,
} from "@/lib/enquiries";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateEnquiryStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const status = asString(formData, "status") as EnquiryStatus;
  if (!ENQUIRY_STATUSES.includes(status)) {
    return { ok: false as const, error: "Invalid status." };
  }
  const result = await updateEnquiryStatus(supabase, {
    id: asString(formData, "id"),
    status,
    nextFollowUpOn: asString(formData, "next_follow_up_on") || null,
  });
  if (result.ok) revalidatePath("/admin/enquiries");
  return result;
}

export async function addEnquiryFollowupAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const result = await addEnquiryFollowup(supabase, {
    enquiryId: asString(formData, "enquiry_id"),
    body: asString(formData, "body"),
    createdBy: user.id,
    channel: "note",
  });
  if (result.ok) revalidatePath("/admin/enquiries");
  return result;
}
