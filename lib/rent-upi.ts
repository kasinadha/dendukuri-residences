/** Public UPI details for tenant rent payments (QR / deep link). */
export function getRentUpiConfig(): {
  upiId: string | null;
  payeeName: string;
} {
  const upiId =
    process.env.NEXT_PUBLIC_RENT_UPI_ID?.trim() ||
    process.env.RENT_UPI_ID?.trim() ||
    null;
  const payeeName =
    process.env.NEXT_PUBLIC_RENT_UPI_NAME?.trim() ||
    "Dendukuri's Residences";
  return { upiId, payeeName };
}

/** Prefer per-flat UPI/QR; fall back to global env. */
export function resolveRentUpiDisplay(input?: {
  upiId?: string | null;
  upiQrUrl?: string | null;
} | null): {
  upiId: string | null;
  upiQrUrl: string | null;
  payeeName: string;
} {
  const global = getRentUpiConfig();
  return {
    upiId: input?.upiId?.trim() || global.upiId,
    upiQrUrl: input?.upiQrUrl?.trim() || null,
    payeeName: global.payeeName,
  };
}

export function buildUpiPayLink(input: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName,
    am: String(input.amount),
    cu: "INR",
    tn: input.note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

export function buildUpiQrImageUrl(upiPayLink: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    upiPayLink
  )}`;
}

export function currentBillingMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
