"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { updatePaymentAccount } from "@/lib/payment-accounts";
import type { BuildingWing } from "@/lib/building-wing";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asBuildingWing(value: string): BuildingWing | null {
  const wing = value.trim().toUpperCase();
  if (wing === "C" || wing === "D") return wing;
  return null;
}

export async function updatePaymentAccountAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await updatePaymentAccount(supabase, {
    id: asString(formData, "id"),
    label: asString(formData, "label"),
    upiId: asString(formData, "upi_id") || null,
    upiQrUrl: asString(formData, "upi_qr_url") || null,
    buildingWing: asBuildingWing(asString(formData, "building_wing")),
    notes: asString(formData, "notes") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/payments");
  }

  return result;
}
