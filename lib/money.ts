/** Parse rupee amounts from form fields. Returns null when invalid. */
export function parseRupeeAmount(
  raw: string,
  options?: { allowZero?: boolean }
): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (!options?.allowZero && n <= 0) return null;
  return Math.round(n);
}

/** Meter / unit readings: finite and not negative. */
export function parseMeterReading(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function isValidBillingMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value.trim());
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Map Postgres constraint errors to a short tenant/admin message. */
export function friendlyDatabaseError(message: string): string {
  if (
    /payments_utr_live_uidx|duplicate key.*transaction_reference/i.test(message)
  ) {
    return "This UTR / transaction reference is already recorded. Use a different reference, or void the earlier payment first.";
  }
  if (
    /electricity_readings_run_flat_uidx|duplicate key.*electricity_readings/i.test(
      message
    )
  ) {
    return "A reading for this flat already exists in this billing run.";
  }
  if (/electricity_readings_monotonic/i.test(message)) {
    return "Current meter reading must be greater than or equal to the previous reading.";
  }
  if (
    /electricity_billing_runs_month_wing|electricity_readings_flat_date/i.test(
      message
    )
  ) {
    return "A billing run or reading already exists for this month.";
  }
  if (/payments_amount_paid|payments_amount_due/i.test(message)) {
    return "Amount cannot be negative.";
  }
  if (/tenant_change_requests_pending/i.test(message)) {
    return "A name change is already waiting for owner approval.";
  }
  if (/payment_allocations_amount_chk/i.test(message)) {
    return "Each month allocation must be greater than zero.";
  }
  return message;
}

export function isMissingColumnError(message: string | null | undefined): boolean {
  return Boolean(
    message && /column .* does not exist|could not find.*column/i.test(message)
  );
}
