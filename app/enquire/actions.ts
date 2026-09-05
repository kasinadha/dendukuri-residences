"use server";

import { createEnquiry, enquiryContinueWhatsAppUrl } from "@/lib/enquiries";
import { createClient } from "@/lib/supabase/server";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitEnquiryAction(formData: FormData) {
  const supabase = await createClient();
  const fullName = asString(formData, "full_name");
  const phone = asString(formData, "phone");
  const bhkPreference = asString(formData, "bhk_preference") || null;
  const moveInMonth = asString(formData, "move_in_month") || null;

  const result = await createEnquiry(supabase, {
    fullName,
    phone,
    bhkPreference,
    moveInMonth,
    budgetRange: asString(formData, "budget_range") || null,
    occupants: asString(formData, "occupants") || null,
    parkingNeed: asString(formData, "parking_need") || null,
    heardFrom: asString(formData, "heard_from") || null,
    notes: asString(formData, "notes") || null,
  });

  if (!result.ok) return result;

  return {
    ok: true as const,
    id: result.id,
    whatsappUrl: enquiryContinueWhatsAppUrl({
      fullName,
      phone,
      bhkPreference,
      moveInMonth,
    }),
  };
}
