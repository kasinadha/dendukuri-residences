import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import type { BuildingDepositRow } from "@/lib/deposits";
import { loadDepositSummary } from "@/lib/deposits";
import {
  parseDuesBreakdownFromNotes,
  type DuesBreakdown,
} from "@/lib/dues-breakdown";
import { parseBillingMonthFromNotes } from "@/lib/receipts";

export type { BuildingDepositRow } from "@/lib/deposits";

export type DuesCategoryBreakdown = {
  rent: number;
  electricity: number;
  other: number;
};

const EMPTY_DUES_BREAKDOWN: DuesCategoryBreakdown = {
  rent: 0,
  electricity: 0,
  other: 0,
};

export type BuildingRevenueRow = {
  wing: BuildingWing;
  label: string;
  /** Rent + monthly charges collected this period */
  duesCollected: number;
  /** Rent / electricity / other monthly charges collected this period */
  duesBreakdown: DuesCategoryBreakdown;
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
  depositsByBuilding: BuildingDepositRow[];
  totalDepositsAgreed: number;
  totalDepositsPaid: number;
  totalDepositsReturned: number;
  totalDepositsHeld: number;
  byBuilding: BuildingRevenueRow[];
  sharedBuildingExpenses: SharedBuildingExpenseSummary;
  byAccount: AccountRevenueRow[];
  expensesByPayer: AccountExpenseRow[];
  /** Monthly dues only (rent + maintenance) */
  totalDuesCollected: number;
  totalDuesBreakdown: DuesCategoryBreakdown;
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

function categoryTotalsFromBreakdown(
  breakdown: DuesBreakdown
): DuesCategoryBreakdown {
  const totals: DuesCategoryBreakdown = { rent: 0, electricity: 0, other: 0 };
  const allLines = [
    ...breakdown.lines,
    ...(breakdown.arrears?.flatMap((month) => month.lines) ?? []),
  ];
  for (const line of allLines) {
    const paid = num(line.paid);
    if (paid <= 0) continue;
    if (line.key === "rent") totals.rent += paid;
    else if (line.key === "electricity") totals.electricity += paid;
    else totals.other += paid;
  }
  return totals;
}

function diffDuesBreakdown(
  current: DuesCategoryBreakdown,
  previous: DuesCategoryBreakdown
): DuesCategoryBreakdown {
  return {
    rent: Math.max(0, current.rent - previous.rent),
    electricity: Math.max(0, current.electricity - previous.electricity),
    other: Math.max(0, current.other - previous.other),
  };
}

function addDuesBreakdown(
  target: DuesCategoryBreakdown,
  delta: DuesCategoryBreakdown
): void {
  target.rent += delta.rent;
  target.electricity += delta.electricity;
  target.other += delta.other;
}

function fallbackDuesCategoryForPayment(
  paymentType: string | null | undefined,
  amount: number
): DuesCategoryBreakdown {
  const type = String(paymentType ?? "rent").toLowerCase();
  if (type === "maintenance") {
    return { rent: 0, electricity: 0, other: amount };
  }
  return { rent: amount, electricity: 0, other: 0 };
}

type TenancyDuesPayment = {
  amount: number;
  paymentType: string | null;
  notes: string | null;
  paymentDate: string;
};

function incrementalDuesBreakdownForTenancy(
  payments: TenancyDuesPayment[]
): DuesCategoryBreakdown {
  const sorted = [...payments].sort((a, b) =>
    a.paymentDate.localeCompare(b.paymentDate)
  );
  const totals: DuesCategoryBreakdown = { ...EMPTY_DUES_BREAKDOWN };
  let previous = { ...EMPTY_DUES_BREAKDOWN };

  for (const payment of sorted) {
    const breakdown = parseDuesBreakdownFromNotes(payment.notes);
    if (breakdown) {
      const current = categoryTotalsFromBreakdown(breakdown);
      addDuesBreakdown(totals, diffDuesBreakdown(current, previous));
      previous = current;
      continue;
    }

    const incremental = fallbackDuesCategoryForPayment(
      payment.paymentType,
      payment.amount
    );
    addDuesBreakdown(totals, incremental);
    addDuesBreakdown(previous, incremental);
  }

  return totals;
}

async function loadDepositTotalsByBuilding(
  supabase: SupabaseClient
): Promise<{
  byBuilding: BuildingDepositRow[];
  totalAgreed: number;
  totalCollected: number;
  totalReturned: number;
  totalHeld: number;
}> {
  const summary = await loadDepositSummary(supabase);
  return {
    byBuilding: summary.byBuilding,
    totalAgreed: summary.totalAgreed,
    totalCollected: summary.totalCollected,
    totalReturned: summary.totalReturned,
    totalHeld: summary.totalHeld,
  };
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
    depositSummary,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `
          id,
          tenancy_id,
          amount_paid,
          payment_type,
          payment_date,
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
  const depositsByBuilding = depositSummary.byBuilding;
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
  const buildingDuesBreakdown = new Map<BuildingWing, DuesCategoryBreakdown>();
  const tenancyDuesPayments = new Map<
    string,
    { wing: BuildingWing; payments: TenancyDuesPayment[] }
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
  const totalDuesBreakdown: DuesCategoryBreakdown = { ...EMPTY_DUES_BREAKDOWN };

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
    const tenancyId = String(row.tenancy_id ?? "");
    if (wing) {
      const map =
        bucket === "deposit" ? buildingDepositTotals : buildingDuesTotals;
      const prev = map.get(wing) ?? { collected: 0, count: 0 };
      map.set(wing, {
        collected: prev.collected + amount,
        count: prev.count + 1,
      });

      if (bucket === "dues" && tenancyId) {
        const group = tenancyDuesPayments.get(tenancyId) ?? {
          wing,
          payments: [],
        };
        group.payments.push({
          amount,
          paymentType: (row.payment_type as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
          paymentDate: String(row.payment_date ?? ""),
        });
        tenancyDuesPayments.set(tenancyId, group);
      }
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

  for (const { wing, payments } of tenancyDuesPayments.values()) {
    const breakdown = incrementalDuesBreakdownForTenancy(payments);
    const wingTotals = buildingDuesBreakdown.get(wing) ?? {
      ...EMPTY_DUES_BREAKDOWN,
    };
    addDuesBreakdown(wingTotals, breakdown);
    buildingDuesBreakdown.set(wing, wingTotals);
    addDuesBreakdown(totalDuesBreakdown, breakdown);
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
        duesBreakdown:
          buildingDuesBreakdown.get(wing) ?? { ...EMPTY_DUES_BREAKDOWN },
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

  const totalDepositsAgreed = depositSummary.totalAgreed;
  const totalDepositsPaid = depositSummary.totalCollected;
  const totalDepositsReturned = depositSummary.totalReturned;
  const totalDepositsHeld = depositSummary.totalHeld;

  return {
    billingMonthKey: billingMonth,
    depositsByBuilding,
    totalDepositsAgreed,
    totalDepositsPaid,
    totalDepositsReturned,
    totalDepositsHeld,
    byBuilding,
    sharedBuildingExpenses: {
      spent: sharedTotals.spent,
      expenseCount: sharedTotals.count,
    },
    byAccount,
    expensesByPayer,
    totalDuesCollected,
    totalDuesBreakdown,
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
