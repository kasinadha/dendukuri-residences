import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import { parseBillingMonthFromNotes } from "@/lib/receipts";

export type BuildingDepositRow = {
  wing: BuildingWing;
  label: string;
  /** Total advance agreed across tenancies */
  agreed: number;
  /** Total advance/deposit paid (all time, from tenancy records) */
  paid: number;
  outstanding: number;
  tenantCount: number;
};

export type BuildingRevenueRow = {
  wing: BuildingWing;
  label: string;
  /** Rent + monthly charges collected this period */
  duesCollected: number;
  /** Deposit / advance collected this period */
  depositsCollected: number;
  spent: number;
  /** Dues collected minus expenses (deposits excluded) */
  net: number;
  duesPaymentCount: number;
  depositPaymentCount: number;
  expenseCount: number;
};

export type SharedBuildingExpenseSummary = {
  spent: number;
  expenseCount: number;
};

export type AccountRevenueRow = {
  accountId: string | null;
  accountLabel: string;
  duesCollected: number;
  depositsCollected: number;
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
  /** All-time deposit balances by building (from tenancy records) */
  depositsByBuilding: BuildingDepositRow[];
  totalDepositsAgreed: number;
  totalDepositsPaid: number;
  byBuilding: BuildingRevenueRow[];
  sharedBuildingExpenses: SharedBuildingExpenseSummary;
  byAccount: AccountRevenueRow[];
  expensesByPayer: AccountExpenseRow[];
  /** Monthly dues only (rent + maintenance) */
  totalDuesCollected: number;
  /** Deposit/advance payments in the selected period */
  totalDepositsCollected: number;
  totalExpenses: number;
};

const DUES_PAYMENT_TYPES = new Set(["rent", "maintenance"]);
const DEPOSIT_PAYMENT_TYPES = new Set(["advance"]);

function paymentBucket(
  paymentType: string | null | undefined
): "dues" | "deposit" {
  const type = String(paymentType ?? "rent").toLowerCase();
  if (DEPOSIT_PAYMENT_TYPES.has(type)) return "deposit";
  if (DUES_PAYMENT_TYPES.has(type)) return "dues";
  return "dues";
}

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

async function loadDepositTotalsByBuilding(
  supabase: SupabaseClient
): Promise<BuildingDepositRow[]> {
  const { data } = await supabase.from("tenancies").select(`
      deposit_amount,
      deposit_paid,
      security_deposit,
      flats ( flat_number )
    `);

  const byWing = new Map<
    BuildingWing,
    { agreed: number; paid: number; count: number }
  >();

  for (const row of data ?? []) {
    const flat = unwrapOne(row.flats as { flat_number?: string } | null);
    const wing = buildingWingFromFlatNumber(flat?.flat_number ?? null);
    if (!wing) continue;

    const agreed =
      num(row.deposit_amount) > 0
        ? num(row.deposit_amount)
        : num(row.security_deposit);
    const paid = num(row.deposit_paid);
    if (agreed <= 0 && paid <= 0) continue;

    const prev = byWing.get(wing) ?? { agreed: 0, paid: 0, count: 0 };
    byWing.set(wing, {
      agreed: prev.agreed + agreed,
      paid: prev.paid + paid,
      count: prev.count + 1,
    });
  }

  return (["C", "D"] as BuildingWing[]).map((wing) => {
    const totals = byWing.get(wing) ?? { agreed: 0, paid: 0, count: 0 };
    return {
      wing,
      label: buildingWingLabel(wing),
      agreed: totals.agreed,
      paid: totals.paid,
      outstanding: Math.max(0, totals.agreed - totals.paid),
      tenantCount: totals.count,
    };
  });
}

export async function getBuildingRevenueReport(
  supabase: SupabaseClient,
  options?: { billingMonth?: string }
): Promise<BuildingRevenueReport> {
  const billingMonth = options?.billingMonth?.trim() || null;

  const [
    paymentsResult,
    accountsResult,
    tankersResult,
    maintenanceResult,
    otherResult,
    depositsByBuilding,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `
          id,
          amount_paid,
          payment_type,
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
    loadDepositTotalsByBuilding(supabase),
  ]);

  const accountLabelById = new Map<string, string>();
  for (const row of accountsResult.data ?? []) {
    accountLabelById.set(row.id, row.label?.trim() || row.code || "Account");
  }

  const buildingDuesTotals = new Map<
    BuildingWing,
    { collected: number; count: number }
  >();
  const buildingDepositTotals = new Map<
    BuildingWing,
    { collected: number; count: number }
  >();
  const accountTotals = new Map<
    string | null,
    {
      duesCollected: number;
      depositsCollected: number;
      count: number;
      label: string;
    }
  >();
  let totalDuesCollected = 0;
  let totalDepositsCollected = 0;

  for (const row of paymentsResult.data ?? []) {
    const amount = num(row.amount_paid);
    if (amount <= 0) continue;

    const { billingMonthKey } = parseBillingMonthFromNotes(row.notes);
    if (billingMonth && billingMonthKey !== billingMonth) continue;

    const bucket = paymentBucket(row.payment_type as string | null);
    if (bucket === "deposit") totalDepositsCollected += amount;
    else totalDuesCollected += amount;

    const tenancy = unwrapOne(row.tenancies);
    const flat = unwrapOne(tenancy?.flats ?? null);
    const flatNumber = flat?.flat_number ?? null;
    const wing = buildingWingFromFlatNumber(flatNumber);
    if (wing) {
      const map =
        bucket === "deposit" ? buildingDepositTotals : buildingDuesTotals;
      const prev = map.get(wing) ?? { collected: 0, count: 0 };
      map.set(wing, {
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
      duesCollected: 0,
      depositsCollected: 0,
      count: 0,
      label,
    };
    accountTotals.set(accountId, {
      duesCollected:
        prevAccount.duesCollected + (bucket === "dues" ? amount : 0),
      depositsCollected:
        prevAccount.depositsCollected + (bucket === "deposit" ? amount : 0),
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
      const dues = buildingDuesTotals.get(wing) ?? { collected: 0, count: 0 };
      const deposits = buildingDepositTotals.get(wing) ?? {
        collected: 0,
        count: 0,
      };
      const expense = buildingExpenseTotals.get(wing) ?? { spent: 0, count: 0 };
      return {
        wing,
        label: buildingWingLabel(wing),
        duesCollected: dues.collected,
        depositsCollected: deposits.collected,
        spent: expense.spent,
        net: dues.collected - expense.spent,
        duesPaymentCount: dues.count,
        depositPaymentCount: deposits.count,
        expenseCount: expense.count,
      };
    }
  );

  const byAccount: AccountRevenueRow[] = [...accountTotals.entries()]
    .map(([accountId, totals]) => ({
      accountId,
      accountLabel: totals.label,
      duesCollected: totals.duesCollected,
      depositsCollected: totals.depositsCollected,
      paymentCount: totals.count,
    }))
    .sort(
      (a, b) =>
        b.duesCollected +
        b.depositsCollected -
        (a.duesCollected + a.depositsCollected)
    );

  const expensesByPayer: AccountExpenseRow[] = [...expenseTotals.entries()]
    .map(([accountId, totals]) => ({
      accountId,
      accountLabel: totals.label,
      spent: totals.spent,
      expenseCount: totals.count,
    }))
    .sort((a, b) => b.spent - a.spent);

  const totalDepositsAgreed = depositsByBuilding.reduce(
    (sum, row) => sum + row.agreed,
    0
  );
  const totalDepositsPaid = depositsByBuilding.reduce(
    (sum, row) => sum + row.paid,
    0
  );

  return {
    billingMonthKey: billingMonth,
    depositsByBuilding,
    totalDepositsAgreed,
    totalDepositsPaid,
    byBuilding,
    sharedBuildingExpenses: {
      spent: sharedTotals.spent,
      expenseCount: sharedTotals.count,
    },
    byAccount,
    expensesByPayer,
    totalDuesCollected,
    totalDepositsCollected,
    totalExpenses,
  };
}

/** Sum deposit/advance payments received in a billing month. */
export async function getMonthlyDepositsCollected(
  supabase: SupabaseClient,
  billingMonthKey: string
): Promise<number> {
  const { data } = await supabase
    .from("payments")
    .select("amount_paid, notes, payment_type")
    .eq("payment_type", "advance")
    .gt("amount_paid", 0);

  let total = 0;
  for (const row of data ?? []) {
    const { billingMonthKey: key } = parseBillingMonthFromNotes(row.notes);
    if (key !== billingMonthKey) continue;
    total += num(row.amount_paid);
  }
  return total;
}
