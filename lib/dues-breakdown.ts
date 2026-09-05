export type DuesBreakdownLine = {
  key: string;
  label: string;
  due: number;
  paid: number;
  outstanding: number;
  /** Prior-month line shown in the current pay view */
  isArrears?: boolean;
  arrearsMonthKey?: string;
  /** Outstanding portion rolled in from the prior billing month */
  arrearsOutstanding?: number;
  arrearsMonthLabel?: string;
};

export type ArrearsMonthBreakdown = {
  billingMonthKey: string;
  billingMonthLabel: string;
  lines: DuesBreakdownLine[];
  totalOutstanding: number;
};

/** Waterfall order when a lump-sum payment covers multiple dues. */
export const DUES_LINE_ALLOCATION_ORDER = [
  "rent",
  "maintenance",
  "parking",
  "washer",
  "other",
  "fines",
  "electricity",
] as const;

function cloneLines(lines: DuesBreakdownLine[]): DuesBreakdownLine[] {
  return lines.map((line) => ({ ...line }));
}

/** Allocate cumulative payments across due lines (mutates `lines`). */
export function allocatePaymentsAcrossLines(
  lines: DuesBreakdownLine[],
  totalPaid: number
): void {
  let remaining = Math.max(0, totalPaid);
  for (const key of DUES_LINE_ALLOCATION_ORDER) {
    const line = lines.find((item) => item.key === key);
    if (!line) continue;
    const applied = Math.min(line.due, remaining);
    line.paid = applied;
    line.outstanding = Math.max(0, line.due - applied);
    remaining -= applied;
  }
}

export function computeBreakdownTotals(
  lines: DuesBreakdownLine[]
): Pick<DuesBreakdown, "totalDue" | "totalPaid" | "totalOutstanding"> {
  const totalDue = lines.reduce((sum, line) => sum + line.due, 0);
  const totalPaid = lines.reduce((sum, line) => sum + line.paid, 0);
  const totalOutstanding = lines.reduce((sum, line) => sum + line.outstanding, 0);
  return { totalDue, totalPaid, totalOutstanding };
}

/** Preview or persist how an additional payment applies on top of prior allocations. */
export function applyAdditionalPaymentToBreakdown(
  breakdown: DuesBreakdown,
  additionalPaid: number
): DuesBreakdown {
  if (!Number.isFinite(additionalPaid) || additionalPaid <= 0) {
    return breakdown;
  }

  let remaining = additionalPaid;
  const arrears =
    breakdown.arrears?.map((month) => ({
      ...month,
      lines: cloneLines(month.lines),
    })) ?? [];

  for (const month of [...arrears].reverse()) {
    for (const key of DUES_LINE_ALLOCATION_ORDER) {
      const line = month.lines.find((item) => item.key === key);
      if (!line || line.outstanding <= 0) continue;
      const applied = Math.min(line.outstanding, remaining);
      line.paid += applied;
      line.outstanding -= applied;
      remaining -= applied;
    }
    month.totalOutstanding = month.lines.reduce(
      (sum, line) => sum + line.outstanding,
      0
    );
  }

  const lines = cloneLines(breakdown.lines);
  const priorPaid = lines.reduce((sum, line) => sum + line.paid, 0);
  allocatePaymentsAcrossLines(lines, priorPaid + remaining);

  const { totalDue, totalPaid, totalOutstanding } = computeBreakdownTotals(lines);
  const arrearsTotal = arrears.reduce(
    (sum, month) => sum + month.totalOutstanding,
    0
  );

  return {
    billingMonthKey: breakdown.billingMonthKey,
    lines,
    totalDue,
    totalPaid,
    totalOutstanding,
    arrears: arrears.length > 0 ? arrears : breakdown.arrears,
    grandTotalOutstanding: totalOutstanding + arrearsTotal,
    priorMonthLabel: breakdown.priorMonthLabel,
    priorMonthArrearsTotal:
      arrearsTotal > 0 ? arrearsTotal : breakdown.priorMonthArrearsTotal,
    infoMessage: breakdown.infoMessage,
  };
}

export type DuesBreakdown = {
  billingMonthKey: string;
  lines: DuesBreakdownLine[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  /** Unpaid balances from earlier billing months */
  arrears?: ArrearsMonthBreakdown[];
  /** Current month outstanding + all arrears */
  grandTotalOutstanding?: number;
  /** Prior billing month with rolled-up arrears (one month back) */
  priorMonthLabel?: string;
  priorMonthArrearsTotal?: number;
  /** e.g. move-in month — no dues yet */
  infoMessage?: string;
};

export type DuesCategoryBreakdown = {
  rent: number;
  electricity: number;
  other: number;
};

/** Reset paid fields so payments can be re-applied in waterfall order. */
export function resetBreakdownForAllocation(
  breakdown: DuesBreakdown
): DuesBreakdown {
  const resetLine = (line: DuesBreakdownLine): DuesBreakdownLine => {
    const owed = Math.max(0, line.outstanding + line.paid);
    return {
      ...line,
      paid: 0,
      outstanding: owed,
      due: Math.max(line.due, owed),
    };
  };

  const arrears = breakdown.arrears?.map((month) => {
    const lines = month.lines.map(resetLine);
    return {
      ...month,
      lines,
      totalOutstanding: lines.reduce((sum, line) => sum + line.outstanding, 0),
    };
  });

  const lines = breakdown.lines.map(resetLine);
  const totals = computeBreakdownTotals(lines);
  const arrearsTotal =
    arrears?.reduce((sum, month) => sum + month.totalOutstanding, 0) ?? 0;

  return {
    ...breakdown,
    lines,
    arrears,
    totalDue: totals.totalDue,
    totalPaid: 0,
    totalOutstanding: totals.totalOutstanding + arrearsTotal,
    grandTotalOutstanding: totals.totalOutstanding + arrearsTotal,
    priorMonthArrearsTotal:
      arrearsTotal > 0 ? arrearsTotal : breakdown.priorMonthArrearsTotal,
  };
}

export const EMPTY_DUES_CATEGORY_BREAKDOWN: DuesCategoryBreakdown = {
  rent: 0,
  electricity: 0,
  other: 0,
};

function addCategoryAmount(
  target: DuesCategoryBreakdown,
  key: string,
  amount: number
): void {
  if (amount <= 0) return;
  if (key === "rent") target.rent += amount;
  else if (key === "electricity") target.electricity += amount;
  else target.other += amount;
}

export function addDuesCategoryBreakdown(
  target: DuesCategoryBreakdown,
  delta: DuesCategoryBreakdown
): void {
  target.rent += delta.rent;
  target.electricity += delta.electricity;
  target.other += delta.other;
}

function paidMapFromLines(lines: DuesBreakdownLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.key, (map.get(line.key) ?? 0) + Math.max(0, line.paid));
  }
  return map;
}

function paidIncreaseMap(
  before: Map<string, number>,
  afterLines: DuesBreakdownLine[]
): Map<string, number> {
  const increase = new Map<string, number>();
  const after = paidMapFromLines(afterLines);
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const delta = Math.max(0, (after.get(key) ?? 0) - (before.get(key) ?? 0));
    if (delta > 0) increase.set(key, delta);
  }
  return increase;
}

/** Take the latest rupees of a payment from paid-by-category (electricity last in, first out). */
export function peelCategoriesFromPaidMap(
  amount: number,
  available: Map<string, number>
): DuesCategoryBreakdown {
  const totals: DuesCategoryBreakdown = { ...EMPTY_DUES_CATEGORY_BREAKDOWN };
  let remaining = Math.max(0, Math.round(amount));
  for (const key of [...DUES_LINE_ALLOCATION_ORDER].reverse()) {
    if (remaining <= 0) break;
    const take = Math.min(Math.max(0, available.get(key) ?? 0), remaining);
    if (take <= 0) continue;
    addCategoryAmount(totals, key, take);
    remaining -= take;
  }
  if (remaining > 0) totals.rent += remaining;
  return totals;
}

/** Current billing-month lines only — do not fold arrears into this month's split. */
export function categoryTotalsFromCurrentMonthLines(
  breakdown: DuesBreakdown
): DuesCategoryBreakdown {
  const totals: DuesCategoryBreakdown = { ...EMPTY_DUES_CATEGORY_BREAKDOWN };
  for (const line of breakdown.lines) {
    addCategoryAmount(totals, line.key, line.paid);
  }
  return totals;
}

function withoutArrears(breakdown: DuesBreakdown): DuesBreakdown {
  const totals = computeBreakdownTotals(breakdown.lines);
  return {
    ...breakdown,
    arrears: undefined,
    totalDue: totals.totalDue,
    totalPaid: totals.totalPaid,
    totalOutstanding: totals.totalOutstanding,
    grandTotalOutstanding: totals.totalOutstanding,
    priorMonthArrearsTotal: undefined,
  };
}

/** Sum paid amounts by rent / electricity / other (maintenance, parking, etc.). */
export function categoryTotalsFromBreakdown(
  breakdown: DuesBreakdown
): DuesCategoryBreakdown {
  const combined = toCombinedBreakdownView(breakdown);
  const totals: DuesCategoryBreakdown = { ...EMPTY_DUES_CATEGORY_BREAKDOWN };
  for (const line of combined.lines) {
    addCategoryAmount(totals, line.key, line.paid);
  }
  return totals;
}

export const DUES_BREAKDOWN_PREFIX = "dues_breakdown:";

export function encodeDuesBreakdownNote(breakdown: DuesBreakdown): string {
  return `${DUES_BREAKDOWN_PREFIX}${JSON.stringify(breakdown)}`;
}

export function parseDuesBreakdownFromNotes(
  notes: string | null | undefined
): DuesBreakdown | null {
  if (!notes) return null;
  const idx = notes.indexOf(DUES_BREAKDOWN_PREFIX);
  if (idx === -1) return null;
  const jsonText = notes.slice(idx + DUES_BREAKDOWN_PREFIX.length).trim();
  const payload = jsonText.split("\n")[0]?.trim();
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as DuesBreakdown;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type MonthAttributedPayment = {
  amount: number;
  paymentDate: string;
  notes: string | null;
  id?: string;
};

/**
 * Split this month's collected cash into rent / electricity / other.
 * Uses each payment's stored dues snapshot (current-month line increases) so a
 * follow-up electricity payment is not re-applied as rent. Falls back to a
 * current-month waterfall when a snapshot is missing.
 */
export function collectedCategoriesForMonthPayments(
  payments: MonthAttributedPayment[],
  billingMonthKey: string,
  seed: DuesBreakdown | null
): DuesCategoryBreakdown {
  const sorted = [...payments].sort((a, b) => {
    const dateCmp = a.paymentDate.localeCompare(b.paymentDate);
    if (dateCmp !== 0) return dateCmp;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });

  const totals: DuesCategoryBreakdown = { ...EMPTY_DUES_CATEGORY_BREAKDOWN };
  let running: DuesBreakdown | null = seed
    ? resetBreakdownForAllocation(withoutArrears(seed))
    : null;

  for (const payment of sorted) {
    const amount = Math.round(Math.max(0, payment.amount));
    if (amount <= 0) continue;

    const snapshot = parseDuesBreakdownFromNotes(payment.notes);
    const snapshotForMonth =
      snapshot &&
      (!snapshot.billingMonthKey ||
        snapshot.billingMonthKey === billingMonthKey)
        ? withoutArrears(snapshot)
        : null;

    if (snapshotForMonth) {
      const increase = paidIncreaseMap(
        paidMapFromLines(running?.lines ?? []),
        snapshotForMonth.lines
      );
      const increaseTotal = [...increase.values()].reduce(
        (sum, value) => sum + value,
        0
      );
      if (increaseTotal > 0) {
        addDuesCategoryBreakdown(
          totals,
          peelCategoriesFromPaidMap(amount, increase)
        );
        running = snapshotForMonth;
        continue;
      }
    }

    if (running) {
      const before = categoryTotalsFromCurrentMonthLines(running);
      running = applyAdditionalPaymentToBreakdown(running, amount);
      const after = categoryTotalsFromCurrentMonthLines(running);
      addDuesCategoryBreakdown(totals, {
        rent: Math.max(0, after.rent - before.rent),
        electricity: Math.max(0, after.electricity - before.electricity),
        other: Math.max(0, after.other - before.other),
      });
      continue;
    }

    totals.rent += amount;
  }

  return totals;
}

export function appendDuesBreakdownToNotes(
  existingNotes: string | null | undefined,
  breakdown: DuesBreakdown | null
): string | null {
  const base = existingNotes?.trim() || "";
  if (!breakdown) return base || null;
  const encoded = encodeDuesBreakdownNote(breakdown);
  return base ? `${base}\n${encoded}` : encoded;
}

export function parseRupeeAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Sum still owed across the selected month and any arrears. */
export function breakdownGrandOutstanding(breakdown: DuesBreakdown): number {
  return breakdown.grandTotalOutstanding ?? breakdown.totalOutstanding;
}

const LINE_LABELS: Record<string, string> = {
  rent: "Rent",
  maintenance: "Maintenance",
  parking: "Car parking",
  washer: "Washing machine",
  other: "Other monthly",
  fines: "Fines",
  electricity: "Electricity",
};

function baseLineLabel(key: string, fallback?: string): string {
  return fallback?.replace(/\s*\([^)]+\)\s*$/, "").trim() || LINE_LABELS[key] || key;
}

/** Merge prior-month arrears into category rows (rent, electricity, etc.). */
export function toCombinedBreakdownView(breakdown: DuesBreakdown): DuesBreakdown {
  const lineMap = new Map<string, DuesBreakdownLine>();

  const mergeLine = (line: DuesBreakdownLine, arrearsMonthLabel?: string) => {
    const existing = lineMap.get(line.key);
    if (!existing) {
      lineMap.set(line.key, {
        key: line.key,
        label: baseLineLabel(line.key, line.label),
        due: line.due,
        paid: line.paid,
        outstanding: line.outstanding,
        arrearsOutstanding: arrearsMonthLabel && line.outstanding > 0
          ? line.outstanding
          : undefined,
        arrearsMonthLabel:
          arrearsMonthLabel && line.outstanding > 0 ? arrearsMonthLabel : undefined,
      });
      return;
    }

    existing.due += line.due;
    existing.paid += line.paid;
    existing.outstanding += line.outstanding;
    if (arrearsMonthLabel && line.outstanding > 0) {
      existing.arrearsOutstanding =
        (existing.arrearsOutstanding ?? 0) + line.outstanding;
      existing.arrearsMonthLabel = arrearsMonthLabel;
    }
  };

  for (const month of breakdown.arrears ?? []) {
    for (const line of month.lines) {
      mergeLine(line, month.billingMonthLabel);
    }
  }
  for (const line of breakdown.lines) {
    mergeLine(line);
  }

  const lines = [
    ...DUES_LINE_ALLOCATION_ORDER.map((key) => lineMap.get(key)).filter(
      (line): line is DuesBreakdownLine => line != null
    ),
    ...[...lineMap.values()].filter(
      (line) => !DUES_LINE_ALLOCATION_ORDER.includes(line.key as (typeof DUES_LINE_ALLOCATION_ORDER)[number])
    ),
  ];

  const totals = computeBreakdownTotals(lines);
  const priorMonthArrearsTotal = breakdown.priorMonthArrearsTotal ?? 0;

  return {
    ...breakdown,
    lines,
    ...totals,
    grandTotalOutstanding: totals.totalOutstanding,
    priorMonthLabel: breakdown.priorMonthLabel,
    priorMonthArrearsTotal:
      priorMonthArrearsTotal > 0 ? priorMonthArrearsTotal : undefined,
  };
}

/** Defaults for pay / record forms — only what is still owed. */
export function breakdownPaymentAmountDefaults(breakdown: DuesBreakdown): {
  amountDue: string;
  amountPaid: string;
} {
  const outstanding = breakdownGrandOutstanding(breakdown);
  const value = outstanding > 0 ? String(outstanding) : "";
  return { amountDue: value, amountPaid: value };
}

/** Hide fully paid lines; keep only rows with an outstanding balance. */
export function toOutstandingOnlyBreakdown(
  breakdown: DuesBreakdown
): DuesBreakdown {
  const combined = breakdown.arrears?.length
    ? toCombinedBreakdownView(breakdown)
    : breakdown;
  const lines = combined.lines.filter((line) => line.outstanding > 0);
  const totals = computeBreakdownTotals(lines);

  return {
    ...combined,
    lines,
    arrears: undefined,
    ...totals,
    grandTotalOutstanding: totals.totalOutstanding,
  };
}
