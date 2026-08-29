export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(
  rows: CsvRow[],
  columns?: string[]
): string {
  if (rows.length === 0) {
    const headers = columns ?? [];
    return headers.length ? `${headers.join(",")}\n` : "";
  }

  const keys = columns ?? Object.keys(rows[0] ?? {});
  const header = keys.map(escapeCell).join(",");
  const body = rows
    .map((row) => keys.map((key) => escapeCell(row[key])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}
