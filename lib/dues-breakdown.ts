export type DuesBreakdownLine = {
  key: string;
  label: string;
  due: number;
  paid: number;
  outstanding: number;
  /** Prior-month line shown in the current pay view */
  isArrears?: boolean;
  arrearsMonthKey?: string;
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
};

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
