import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  type BuildingWing,
} from "@/lib/building-wing";
import type { ExpenseBuildingWing } from "@/lib/expense-location";

export type OperationalExpense = {
  id: string;
  expenseDate: string;
  title: string;
  category: string | null;
  amount: number;
  buildingWing: ExpenseBuildingWing | null;
  flatId: string | null;
  flatNumber: string | null;
  payerAccountId: string;
  payerAccountLabel: string | null;
  notes: string | null;
  createdAt: string;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBuildingWing(value: unknown): ExpenseBuildingWing | null {
  const trimmed = String(value ?? "").trim().toUpperCase();
  if (trimmed === "C" || trimmed === "D") return trimmed;
  if (trimmed === "SHARED") return "shared";
  return null;
}

export async function listOperationalExpenses(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<OperationalExpense[]> {
  const { data, error } = await supabase
    .from("operational_expenses")
    .select(
      `
      id,
      expense_date,
      title,
      category,
      amount,
      building_wing,
      flat_id,
      notes,
      payer_account_id,
      created_at,
      flats ( flat_number ),
      payment_accounts ( label )
    `
    )
    .order("expense_date", { ascending: false })
    .limit(options?.limit ?? 50);

  if (error || !data) return [];

  return data.map((row) => {
    const flat = Array.isArray(row.flats) ? row.flats[0] : row.flats;
    const payerAccount = Array.isArray(row.payment_accounts)
      ? row.payment_accounts[0]
      : row.payment_accounts;
    const amount = num(row.amount) ?? 0;
    return {
      id: row.id,
      expenseDate: row.expense_date,
      title: row.title?.trim() || "—",
      category: row.category,
      amount,
      buildingWing: parseBuildingWing(row.building_wing),
      flatId: row.flat_id,
      flatNumber: flat?.flat_number?.trim() || null,
      payerAccountId: row.payer_account_id,
      payerAccountLabel: payerAccount?.label?.trim() || null,
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

export async function createOperationalExpense(
  supabase: SupabaseClient,
  input: {
    expenseDate: string;
    title: string;
    category?: string | null;
    amount: number;
    buildingWing?: ExpenseBuildingWing | null;
    flatId?: string | null;
    payerAccountId: string;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.expenseDate) {
    return { ok: false, error: "Expense date is required." };
  }
  if (!input.title.trim()) {
    return { ok: false, error: "Title is required." };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  if (!input.payerAccountId.trim()) {
    return { ok: false, error: "Select who paid for this expense." };
  }
  if (!input.buildingWing && !input.flatId) {
    return {
      ok: false,
      error: "Select a building or flat for this expense.",
    };
  }

  const { data, error } = await supabase
    .from("operational_expenses")
    .insert({
      expense_date: input.expenseDate,
      title: input.title.trim(),
      category: input.category?.trim() || null,
      amount: input.amount,
      building_wing: input.buildingWing || null,
      flat_id: input.flatId || null,
      payer_account_id: input.payerAccountId,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save expense." };
  }

  return { ok: true, id: data.id };
}

export function resolveExpenseBuildingWing(input: {
  buildingWing?: ExpenseBuildingWing | null;
  flatNumber?: string | null;
}): BuildingWing | null {
  if (input.buildingWing && input.buildingWing !== "shared") {
    return input.buildingWing;
  }
  return buildingWingFromFlatNumber(input.flatNumber);
}
