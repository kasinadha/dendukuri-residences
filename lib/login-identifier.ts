/** Normalize login field: email stays email; mobile → 10-digit Indian local. */

export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/** Digits only; strip leading 91 / 0 for 10-digit Indian mobiles. */
export function normalizeIndianMobile(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  return digits;
}

export function classifyLoginIdentifier(raw: string): {
  kind: "email" | "mobile" | "invalid";
  email?: string;
  mobile?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid" };

  if (looksLikeEmail(trimmed)) {
    return { kind: "email", email: trimmed.toLowerCase() };
  }

  const mobile = normalizeIndianMobile(trimmed);
  if (!mobile) return { kind: "invalid" };
  return { kind: "mobile", mobile };
}
