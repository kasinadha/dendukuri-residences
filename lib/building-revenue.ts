import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import { parseBillingMonthFromNotes } from "@/lib/receipts";

export type BuildingRevenueRow = {
  wing: BuildingWing;
  label: string;
  collected: number;
  spent: number;
  net: number;
  paymentCount: number;
  expenseCount: number;
};

export type SharedBuildingExpenseSummary = {
  spent: number;
  expenseCount: number;
};

export type AccountRevenueRow = {
  accountId: string | null;
  accountLabel: string;
  collected: number;
  paymentCount: number;
};

export type AccountExpenseRow = {
  accountId: string | null;
  accountLabel: string;
  spent: number;
  expenseCount: number;
};

export type BuildingRevenueReport = {
  billingMonthKey: string | null;
  byBuilding: BuildingRevenueRow[];
  sharedBuildingExpenses: SharedBuildingExpenseSummary;
  byAccount: AccountRevenueRow[];
  expensesByPayer: AccountExpenseRow[];
  totalCollected: number;
  totalExpenses: number;
};

function matchesBillingMonth(
  dateValue: string | null | undefined,
  billingMonth: string | null
): boolean {
  if (!billingMonth) return true;
  if (!dateValue) return false;
  return dateValue.slice(0, 7) === billingMonth;
}

function resolveExpenseBuilding(
  buildingWing: string | null | undefined,
  flatNumber: string | null | undefined
): BuildingWing | "shared" | null {
  const wing = buildingWing?.trim().toUpperCase() ?? "";
  if (wing === "C" || wing === "D") return wing;
  if (wing === "SHARED") return "shared";
  return buildingWingFromFlatNumber(flatNumber);
}

function addBuildingExpense(
  totals: Map<BuildingWing | "shared", { spent: number; count: number }>,
  wing: BuildingWing | "shared" | null,
  amount: number
) {
  if (!wing || amount <= 0) return;
  const prev = totals.get(wing) ?? { spent: 0, count: 0 };
  totals.set(wing, { spent: prev.spent + amount, count: prev.count + 1 });
}

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getBuildingRevenueReport(
  supabase: SupabaseClient,
  options?: { billingMonth?: string }
): Promise<BuildingRevenueReport> {
  const billingMonth = options?.billingMonth?.trim() || null;

  const [paymentsResult, accountsResult, tankersResult, maintenanceResult, otherResult] =
    await Promise.all([
      supabase
        .from("payments")
        .select(
          `
          id,
          amount_paid,
          notes,
          receiver_account_id,
          tenancies (
            flats ( flat_number, payment_account_id )
          ),
          payment_accounts ( label )
        `
        )
        .gt("amount_paid", 0)
        .order("payment_date", { ascending: false })
        .limit(500),
      supabase
        .from("payment_accounts")
        .select("id,label,code")
        .eq("is_active", true),
      supabase
        .from("water_tankers")
        .select(
          "id,amount,payment_status,payer_account_id,delivery_date,building_wing,flat_id,flats(flat_number),payment_accounts(label)"
        )
        .not("amount", "is", null),
      supabase
        .from("maintenance_requests")
        .select(
          "id,cost,payer_account_id,created_at,flats(flat_number),payment_accounts(label)"
        )
        .not("cost", "is", null),
      supabase
        .from("operational_expenses")
        .select(
          "id,amount,payer_account_id,expense_date,building_wing,flats(flat_number),payment_accounts(label)"
        ),
    ]);

  const accountLabelById = new Map<string, string>();
  for (const row of accountsResult.data ?? []) {
    accountLabelById.set(row.id, row.label?.trim() || row.code || "Account");
  }

  const buildingTotals = new Map<BuildingWing, { collected: number; count: number }>();
  const accountTotals = new Map<
    string | null,
    { collected: number; count: number; label: string }
  >();
  let totalCollected = 0;

  for (const row of paymentsResult.data ?? []) {
    const amount = num(row.amount_paid);
    if (amount <= 0) continue;

    const { billingMonthKey } = parseBillingMonthFromNotes(row.notes);
    if (billingMonth && billingMonthKey !== billingMonth) continue;

    totalCollected += amount;

    const tenancy = unwrapOne(row.tenancies);
    const flat = unwrapOne(tenancy?.flats ?? null);
    const flatNumber = flat?.flat_number ?? null;
    const wing = buildingWingFromFlatNumber(flatNumber);
    if (wing) {
      const prev = buildingTotals.get(wing) ?? { collected: 0, count: 0 };
      buildingTotals.set(wing, {
        collected: prev.collected + amount,
        count: prev.count + 1,
      });
    }

    const accountId = row.receiver_account_id ?? null;
    const accountFromJoin = unwrapOne(row.payment_accounts);
    const label =
      accountFromJoin?.label?.trim() ||
      (accountId ? accountLabelById.get(accountId) : null) ||
      "Unassigned";
    const prevAccount = accountTotals.get(accountId) ?? {
      collected: 0,
      count: 0,
      label,
    };
    accountTotals.set(accountId, {
      collected: prevAccount.collected + amount,
      count: prevAccount.count + 1,
      label,
    });
  }

  const expenseTotals = new Map<
    string | null,
    { spent: number; count: number; label: string }
  >();
  const buildingExpenseTotals = new Map<
    BuildingWing | "shared",
    { spent: number; count: number }
  >();
  let totalExpenses = 0;

  for (const row of tankersResult.data ?? []) {
    if ((row.payment_status ?? "").toLowerCase() === "pending") continue;
    if (!matchesBillingMonth(row.delivery_date as string | null, billingMonth)) {
      continue;
    }
    const amount = num(row.amount);
    if (amount <= 0) continue;
    totalExpenses += amount;
    const flat = unwrapOne(row.flats as { flat_number?: string | null } | null);
    addBuildingExpense(
      buildingExpenseTotals,
      resolveExpenseBuilding(
        row.building_wing as string | null,
        flat?.flat_number ?? null
      ),
      amount
    );
    const accountId = row.payer_account_id ?? null;
    const accountFromJoin = unwrapOne(row.payment_accounts);
    const label =
      accountFromJoin?.label?.trim() ||
      (accountId ? accountLabelById.get(accountId) : null) ||
      "Unassigned";
    const prev = expenseTotals.get(accountId) ?? { spent: 0, count: 0, label };
    expenseTotals.set(accountId, {
      spent: prev.spent + amount,
      count: prev.count + 1,
      label,
    });
  }

  for (const row of maintenanceResult.data ?? []) {
    if (
      !matchesBillingMonth(row.created_at as string | null, billingMonth)
    ) {
      continue;
    }
    const amount = num(row.cost);
    if (amount <= 0) continue;
    totalExpenses += amount;
    const flat = unwrapOne(row.flats as { flat_number?: string | null } | null);
    addBuildingExpense(
      buildingExpenseTotals,
      resolveExpenseBuilding(null, flat?.flat_number ?? null),
      amount
    );
    const accountId = row.payer_account_id ?? null;
    const accountFromJoin = unwrapOne(row.payment_accounts);
    const label =
      accountFromJoin?.label?.trim() ||
      (accountId ? accountLabelById.get(accountId) : null) ||
      "Unassigned";
    const prev = expenseTotals.get(accountId) ?? { spent: 0, count: 0, label };
    expenseTotals.set(accountId, {
      spent: prev.spent + amount,
      count: prev.count + 1,
      label,
    });
  }

  for (const row of otherResult.data ?? []) {
    if (
      !matchesBillingMonth(row.expense_date as string | null, billingMonth)
    ) {
      continue;
    }
    const amount = num(row.amount);
    if (amount <= 0) continue;
    totalExpenses += amount;
    const flat = unwrapOne(row.flats as { flat_number?: string | null } | null);
    addBuildingExpense(
      buildingExpenseTotals,
      resolveExpenseBuilding(
        row.building_wing as string | null,
        flat?.flat_number ?? null
      ),
      amount
    );
    const accountId = row.payer_account_id ?? null;
    const accountFromJoin = unwrapOne(row.payment_accounts);
    const label =
      accountFromJoin?.label?.trim() ||
      (accountId ? accountLabelById.get(accountId) : null) ||
      "Unassigned";
    const prev = expenseTotals.get(accountId) ?? { spent: 0, count: 0, label };
    expenseTotals.set(accountId, {
      spent: prev.spent + amount,
      count: prev.count + 1,
      label,
    });
  }

  const sharedTotals = buildingExpenseTotals.get("shared") ?? {
    spent: 0,
    count: 0,
  };

  const byBuilding: BuildingRevenueRow[] = (["C", "D"] as BuildingWing[]).map(
    (wing) => {
      const totals = buildingTotals.get(wing) ?? { collected: 0, count: 0 };
      const expense = buildingExpenseTotals.get(wing) ?? { spent: 0, count: 0 };
      return {
        wing,
        label: buildingWingLabel(wing),
        collected: totals.collected,
        spent: expense.spent,
        net: totals.collected - expense.spent,
        paymentCount: totals.count,
        expenseCount: expense.count,
      };
    }
  );

  const byAccount: AccountRevenueRow[] = [...accountTotals.entries()]
    .map(([accountId, totals]) => ({
      accountId,
      accountLabel: totals.label,
      collected: totals.collected,
      paymentCount: totals.count,
    }))
    .sort((a, b) => b.collected - a.collected);

  const expensesByPayer: AccountExpenseRow[] = [...expenseTotals.entries()]
    .map(([accountId, totals]) => ({
      accountId,
      accountLabel: totals.label,
      spent: totals.spent,
      expenseCount: totals.count,
    }))
    .sort((a, b) => b.spent - a.spent);

  return {
    billingMonthKey: billingMonth,
    byBuilding,
    sharedBuildingExpenses: {
      spent: sharedTotals.spent,
      expenseCount: sharedTotals.count,
    },
    byAccount,
    expensesByPayer,
    totalCollected,
    totalExpenses,
  };
}
