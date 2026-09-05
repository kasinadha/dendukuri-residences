import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatWhatsAppBusinessPhoneDisplay,
  getWhatsAppBusinessConfig,
  toTenantWhatsAppUrl,
} from "@/lib/whatsapp";

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "visit_planned",
  "interested",
  "not_looking",
  "converted",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export type Enquiry = {
  id: string;
  fullName: string;
  phone: string;
  bhkPreference: string | null;
  moveInMonth: string | null;
  budgetRange: string | null;
  occupants: string | null;
  parkingNeed: string | null;
  heardFrom: string | null;
  notes: string | null;
  status: EnquiryStatus;
  nextFollowUpOn: string | null;
  convertedTenantId: string | null;
  createdAt: string;
  updatedAt: string;
  whatsappUrl: string | null;
  overdue: boolean;
};

export type EnquiryFollowup = {
  id: string;
  enquiryId: string;
  body: string;
  channel: string | null;
  createdAt: string;
};

export function isEnquiryOpen(status: EnquiryStatus): boolean {
  return status !== "not_looking" && status !== "converted";
}

export function defaultNextFollowUpOn(
  status: EnquiryStatus,
  from = new Date()
): string | null {
  if (!isEnquiryOpen(status)) return null;
  const days =
    status === "new" ? 2 : status === "contacted" ? 3 : 7;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function todayIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isOverdue(status: EnquiryStatus, nextFollowUpOn: string | null): boolean {
  if (!isEnquiryOpen(status) || !nextFollowUpOn) return false;
  return nextFollowUpOn <= todayIsoDate();
}

function mapStatus(value: string | null | undefined): EnquiryStatus {
  return ENQUIRY_STATUSES.includes(value as EnquiryStatus)
    ? (value as EnquiryStatus)
    : "new";
}

function buildEnquiryWhatsAppMessage(row: {
  fullName: string;
  bhkPreference: string | null;
  moveInMonth: string | null;
}): string {
  const business = formatWhatsAppBusinessPhoneDisplay(
    getWhatsAppBusinessConfig().businessPhone
  );
  const bits = [
    row.bhkPreference ? `${row.bhkPreference}` : null,
    row.moveInMonth ? `move-in ${row.moveInMonth}` : null,
  ].filter(Boolean);
  const detail = bits.length ? ` (${bits.join(", ")})` : "";
  return `Hi ${row.fullName}, thanks for your enquiry at Dendukuri's Residences${detail}. Do you still want to visit or shall we close this for now? — ${business}`;
}

function mapEnquiry(row: {
  id: string;
  full_name: string;
  phone: string;
  bhk_preference: string | null;
  move_in_month: string | null;
  budget_range: string | null;
  occupants: string | null;
  parking_need: string | null;
  heard_from: string | null;
  notes: string | null;
  status: string;
  next_follow_up_on: string | null;
  converted_tenant_id: string | null;
  created_at: string;
  updated_at: string;
}): Enquiry {
  const status = mapStatus(row.status);
  const message = buildEnquiryWhatsAppMessage({
    fullName: row.full_name,
    bhkPreference: row.bhk_preference,
    moveInMonth: row.move_in_month,
  });
  return {
    id: row.id,
    fullName: row.full_name.trim(),
    phone: row.phone.trim(),
    bhkPreference: row.bhk_preference,
    moveInMonth: row.move_in_month,
    budgetRange: row.budget_range,
    occupants: row.occupants,
    parkingNeed: row.parking_need,
    heardFrom: row.heard_from,
    notes: row.notes,
    status,
    nextFollowUpOn: row.next_follow_up_on,
    convertedTenantId: row.converted_tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    whatsappUrl: toTenantWhatsAppUrl(row.phone, message),
    overdue: isOverdue(status, row.next_follow_up_on),
  };
}

export async function createEnquiry(
  supabase: SupabaseClient,
  input: {
    fullName: string;
    phone: string;
    bhkPreference?: string | null;
    moveInMonth?: string | null;
    budgetRange?: string | null;
    occupants?: string | null;
    parkingNeed?: string | null;
    heardFrom?: string | null;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fullName = input.fullName.trim();
  const phone = input.phone.replace(/\s+/g, "").trim();
  if (fullName.length < 2) {
    return { ok: false, error: "Please enter your name." };
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) {
    return { ok: false, error: "Please enter a valid mobile number." };
  }

  const status: EnquiryStatus = "new";
  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      full_name: fullName,
      phone,
      bhk_preference: input.bhkPreference?.trim() || null,
      move_in_month: input.moveInMonth?.trim() || null,
      budget_range: input.budgetRange?.trim() || null,
      occupants: input.occupants?.trim() || null,
      parking_need: input.parkingNeed?.trim() || null,
      heard_from: input.heardFrom?.trim() || null,
      notes: input.notes?.trim() || null,
      status,
      next_follow_up_on: defaultNextFollowUpOn(status),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save your enquiry." };
  }
  return { ok: true, id: data.id };
}

export async function listEnquiries(
  supabase: SupabaseClient
): Promise<Enquiry[]> {
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      `
      id,
      full_name,
      phone,
      bhk_preference,
      move_in_month,
      budget_range,
      occupants,
      parking_need,
      heard_from,
      notes,
      status,
      next_follow_up_on,
      converted_tenant_id,
      created_at,
      updated_at
    `
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapEnquiry);
}

export async function getEnquiryById(
  supabase: SupabaseClient,
  id: string
): Promise<Enquiry | null> {
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      `
      id,
      full_name,
      phone,
      bhk_preference,
      move_in_month,
      budget_range,
      occupants,
      parking_need,
      heard_from,
      notes,
      status,
      next_follow_up_on,
      converted_tenant_id,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapEnquiry(data);
}

export async function listEnquiryFollowups(
  supabase: SupabaseClient,
  enquiryId: string
): Promise<EnquiryFollowup[]> {
  const { data, error } = await supabase
    .from("enquiry_followups")
    .select("id, enquiry_id, body, channel, created_at")
    .eq("enquiry_id", enquiryId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    enquiryId: row.enquiry_id,
    body: row.body,
    channel: row.channel,
    createdAt: row.created_at,
  }));
}

export async function updateEnquiryStatus(
  supabase: SupabaseClient,
  input: {
    id: string;
    status: EnquiryStatus;
    nextFollowUpOn?: string | null;
    convertedTenantId?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ENQUIRY_STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const nextFollowUpOn =
    input.nextFollowUpOn !== undefined
      ? input.nextFollowUpOn
      : defaultNextFollowUpOn(input.status);

  const { error } = await supabase
    .from("enquiries")
    .update({
      status: input.status,
      next_follow_up_on: nextFollowUpOn,
      converted_tenant_id: input.convertedTenantId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addEnquiryFollowup(
  supabase: SupabaseClient,
  input: {
    enquiryId: string;
    body: string;
    channel?: string | null;
    createdBy: string;
    nextFollowUpOn?: string | null;
    status?: EnquiryStatus;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Add a follow-up note." };

  const { error } = await supabase.from("enquiry_followups").insert({
    enquiry_id: input.enquiryId,
    body,
    channel: input.channel?.trim() || "note",
    created_by: input.createdBy,
  });
  if (error) return { ok: false, error: error.message };

  const enquiry = await getEnquiryById(supabase, input.enquiryId);
  const status = input.status ?? enquiry?.status ?? "contacted";
  const next =
    input.nextFollowUpOn !== undefined
      ? input.nextFollowUpOn
      : defaultNextFollowUpOn(status);

  const { error: updateError } = await supabase
    .from("enquiries")
    .update({
      status,
      next_follow_up_on: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.enquiryId);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

export function enquiryContinueWhatsAppUrl(input: {
  fullName: string;
  phone: string;
  bhkPreference?: string | null;
  moveInMonth?: string | null;
}): string | null {
  const business = getWhatsAppBusinessConfig().businessPhone;
  const bits = [
    input.fullName,
    input.phone,
    input.bhkPreference || null,
    input.moveInMonth ? `move-in ${input.moveInMonth}` : null,
  ].filter(Boolean);
  const text = `Hi, I submitted an enquiry for Dendukuri's Residences. ${bits.join(" · ")}. Please share availability.`;
  return `https://wa.me/${business}?text=${encodeURIComponent(text)}`;
}
