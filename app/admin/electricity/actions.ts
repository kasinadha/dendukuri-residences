"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createElectricityReading } from "@/lib/electricity";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function recordElectricityReading(formData: FormData) {
  const { supabase } = await requireAdmin();

  const result = await createElectricityReading(supabase, {
    flatId: asString(formData, "flat_id"),
    readingDate: asString(formData, "reading_date"),
    previousReading: Number(asString(formData, "previous_reading")),
    currentReading: Number(asString(formData, "current_reading")),
    billAmount: asString(formData, "bill_amount")
      ? Number(asString(formData, "bill_amount"))
      : null,
    status: asString(formData, "status") || "recorded",
    notes: asString(formData, "notes") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/electricity");
    revalidatePath("/tenant");
  }

  return result;
}
