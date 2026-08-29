"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { parseExpenseBuildingWing } from "@/lib/expense-location";
import { createOperationalExpense } from "@/lib/operational-expenses";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createOperationalExpenseAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const amountRaw = asString(formData, "amount");
  const buildingWing = parseExpenseBuildingWing(asString(formData, "building_wing"));
  const flatId = asString(formData, "flat_id") || null;
  const payerAccountId = asString(formData, "payer_account_id");

  const result = await createOperationalExpense(supabase, {
    expenseDate: asString(formData, "expense_date"),
    title: asString(formData, "title"),
    category: asString(formData, "category") || null,
    amount: amountRaw ? Number(amountRaw) : NaN,
    buildingWing,
    flatId,
    payerAccountId,
    notes: asString(formData, "notes") || null,
  });

  if (result.ok) {
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");
  }

  return result;
}
