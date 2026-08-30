export type DuesBreakdownLine = {
  key: string;
  label: string;
  due: number;
  paid: number;
  outstanding: number;
};

export type DuesBreakdown = {
  billingMonthKey: string;
  lines: DuesBreakdownLine[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
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
