import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allocatePaymentsAcrossLines,
  type DuesBreakdownLine,
} from "@/lib/dues-breakdown";
import { roundElectricityDue } from "@/lib/electricity-billing";
import {
  tenancyIncludedInMonthlyLedger,
  tenancyOwesMonthlyDues,
} from "@/lib/rent-billing-month";
import {
  applyOverdueIfNeeded,
  computePaymentStatus,
  type PaymentStatus,
} from "@/lib/payment-status";
import { formatBillingMonthLabel } from "@/lib/receipts";
import { loadFinesDueByTenancy } from "@/lib/fines";
import { buildTenantMonthlyCharges } from "@/lib/tenant-charges";
import {
  amountsByBillingMonth,
  loadRentLedgerPayments,
  waivedAmountForMonth,
  type LedgerPayment,
} from "@/lib/payment-attribution";

function istTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Days past the 5th of the billing month for an unpaid row (IST calendar days). */
export function delayedDaysPastDue(
  billingMonthKey: string,
  outstanding: number,
  todayIso = istTodayIsoDate()
): number {
  if (outstanding <= 0 || !/^\d{4}-\d{2}$/.test(billingMonthKey)) return 0;
  const dueIso = `${billingMonthKey}-05`;
  if (todayIso <= dueIso) return 0;
  const due = Date.parse(`${dueIso}T00:00:00+05:30`);
  const today = Date.parse(`${todayIso}T00:00:00+05:30`);
  if (!Number.isFinite(due) || !Number.isFinite(today) || today <= due) return 0;
  return Math.floor((today - due) / 86_400_000);
}

function currentMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type MonthlyDuesLedgerRow = {
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  billingMonthKey: string;
  startDate: string | null;
  rentDue: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  chargesDue: number;
  finesCharge: number;
  electricityCharge: number;
  totalDue: number;
  rentPaid: number;
  chargesPaid: number;
  amountPaid: number;
  outstanding: number;
  status: PaymentStatus;
  lastPaymentId: string | null;
  lastReceiptId: string | null;
  lastReceiptNumber: string | null;
  lastPaymentDate: string | null;
};

export type MonthlyDuesSummary = {
  billingMonthKey: string;
  billingMonthLabel: string;
  totalExpected: number;
  totalCollected: number;
  outstanding: number;
  collectionRatePercent: number | null;
  delayedDaysMax: number;
  paidTenants: number;
  pendingTenants: number;
  partialTenants: number;
  overdueTenants: number;
  rows: MonthlyDuesLedgerRow[];
};

const TENANCY_SELECT_FULL = `
  id,
  status,
  monthly_rent,
  start_date,
  end_date,
  maintenance_charge,
  car_parking_charge,
  washing_machine_charge,
  other_monthly_charge,
  other_charges_notes,
  tenants ( full_name ),
  flats ( id, flat_number, maintenance_amount )
`;

const TENANCY_SELECT_FALLBACK = `
  id,
  status,
  monthly_rent,
  start_date,
  end_date,
  tenants ( full_name ),
  flats ( id, flat_number, maintenance_amount )
`;

async function loadActiveTenancies(supabase: SupabaseClient) {
  const full = await supabase.from("tenancies").select(TENANCY_SELECT_FULL);
  if (!full.error) return full.data ?? [];

  if (/maintenance_charge|car_parking_charge|washing_machine_charge|other_monthly_charge/i.test(
    full.error.message
  )) {
    const fallback = await supabase
      .from("tenancies")
      .select(TENANCY_SELECT_FALLBACK);
    return fallback.data ?? [];
  }

  return [];
}

function parseBillingMonthFromReadingNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  const match = notes.match(/billing_month:(\d{4}-\d{2})/i);
  return match?.[1] ?? null;
}

function readingBillingMonth(
  row: {
    notes?: string | null;
    electricity_billing_runs?:
      | { billing_month?: string | null }
      | { billing_month?: string | null }[]
      | null;
  }
): string | null {
  const run = unwrapOne(row.electricity_billing_runs);
  return (
    run?.billing_month?.trim() ||
    parseBillingMonthFromReadingNotes(row.notes) ||
    null
  );
}

/** Load per-flat electricity due for a billing month (tenant-safe via readings RLS). */
async function loadElectricityDueByFlatId(
  supabase: SupabaseClient,
  billingMonthKey: string
): Promise<Map<string, number>> {
  const { data: readings, error: readingsError } = await supabase
    .from("electricity_readings")
    .select(
      `
      flat_id,
      bill_amount,
      notes,
      reading_date,
      created_at,
      electricity_billing_runs ( billing_month )
    `
    );

  if (!readingsError && readings) {
    const byFlat = new Map<string, { bill: number; sort: string }>();
    for (const row of readings) {
      if (readingBillingMonth(row) !== billingMonthKey) continue;
      const bill = roundElectricityDue(num(row.bill_amount));
      if (bill <= 0) continue;
      const flatId = String(row.flat_id);
      const sort = `${String(row.reading_date ?? "")} ${String(row.created_at ?? "")}`;
      const prev = byFlat.get(flatId);
      if (!prev || sort >= prev.sort) {
        byFlat.set(flatId, { bill, sort });
      }
    }
    if (byFlat.size > 0) {
      return new Map(
        [...byFlat.entries()].map(([flatId, value]) => [flatId, value.bill])
      );
    }
  }

  // Admin fallback when readings lack billing month metadata.
  const { data: runs, error: runsError } = await supabase
    .from("electricity_billing_runs")
    .select("id")
    .eq("billing_month", billingMonthKey);

  if (runsError || !runs?.length) return new Map();

  const runIds = runs.map((row) => row.id);
  const { data: linkedReadings, error: linkedError } = await supabase
    .from("electricity_readings")
    .select("flat_id, bill_amount, reading_date, created_at")
    .in("billing_run_id", runIds);

  if (linkedError || !linkedReadings) return new Map();

  const byFlat = new Map<string, { bill: number; sort: string }>();
  for (const row of linkedReadings) {
    const bill = roundElectricityDue(num(row.bill_amount));
    if (bill <= 0) continue;
    const flatId = String(row.flat_id);
    const sort = `${String(row.reading_date ?? "")} ${String(row.created_at ?? "")}`;
    const prev = byFlat.get(flatId);
    if (!prev || sort >= prev.sort) {
      byFlat.set(flatId, { bill, sort });
    }
  }
  return new Map(
    [...byFlat.entries()].map(([flatId, value]) => [flatId, value.bill])
  );
}

type PaidBucket = {
  rentPaid: number;
  chargesPaid: number;
  waivedAmount: number;
  lastPaymentId: string | null;
  lastPaymentDate: string | null;
  lastReceiptId: string | null;
  lastReceiptNumber: string | null;
};

function accumulateMonthPayments(
  payments: LedgerPayment[],
  monthKey: string
): Map<string, PaidBucket> {
  const paidByTenancy = new Map<string, PaidBucket>();

  for (const payment of payments) {
    const attributed = amountsByBillingMonth(payment).get(monthKey) ?? 0;
    const waivedAmt = waivedAmountForMonth(payment, monthKey);
    if (attributed <= 0 && waivedAmt <= 0) continue;

    const prev = paidByTenancy.get(payment.tenancyId) ?? {
      rentPaid: 0,
      chargesPaid: 0,
      waivedAmount: 0,
      lastPaymentId: null,
      lastPaymentDate: null,
      lastReceiptId: null,
      lastReceiptNumber: null,
    };

    if (payment.paymentType === "maintenance") prev.chargesPaid += attributed;
    else prev.rentPaid += attributed;
    prev.waivedAmount += waivedAmt;

    if (
      !prev.lastPaymentDate ||
      payment.paymentDate >= prev.lastPaymentDate
    ) {
      prev.lastPaymentId = payment.id;
      prev.lastPaymentDate = payment.paymentDate;
      prev.lastReceiptId = payment.lastReceiptId;
      prev.lastReceiptNumber = payment.lastReceiptNumber;
    }

    paidByTenancy.set(payment.tenancyId, prev);
  }

  return paidByTenancy;
}

function monthCollectionStatus(
  totalDue: number,
  amountPaid: number,
  waivedAmount: number,
  outstanding: number
): PaymentStatus {
  if (outstanding <= 0 && waivedAmount > 0 && amountPaid <= 0) {
    return "waived";
  }
  return computePaymentStatus(totalDue, amountPaid + waivedAmount);
}

function buildMonthlyDuesLines(input: {
  rentDue: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  finesCharge: number;
  electricityCharge: number;
}): DuesBreakdownLine[] {
  const lines: DuesBreakdownLine[] = [];

  if (input.rentDue > 0) {
    lines.push({
      key: "rent",
      label: "Rent",
      due: input.rentDue,
      paid: 0,
      outstanding: input.rentDue,
    });
  }
  if (input.maintenanceCharge > 0) {
    lines.push({
      key: "maintenance",
      label: "Maintenance",
      due: input.maintenanceCharge,
      paid: 0,
      outstanding: input.maintenanceCharge,
    });
  }
  if (input.carParkingCharge > 0) {
    lines.push({
      key: "parking",
      label: "Car parking",
      due: input.carParkingCharge,
      paid: 0,
      outstanding: input.carParkingCharge,
    });
  }
  if (input.washingMachineCharge > 0) {
    lines.push({
      key: "washer",
      label: "Washing machine",
      due: input.washingMachineCharge,
      paid: 0,
      outstanding: input.washingMachineCharge,
    });
  }
  if (input.otherMonthlyCharge > 0) {
    lines.push({
      key: "other",
      label: input.otherChargesNotes?.trim() || "Other monthly",
      due: input.otherMonthlyCharge,
      paid: 0,
      outstanding: input.otherMonthlyCharge,
    });
  }
  if (input.finesCharge > 0) {
    lines.push({
      key: "fines",
      label: "Fines",
      due: input.finesCharge,
      paid: 0,
      outstanding: input.finesCharge,
    });
  }
  if (input.electricityCharge > 0) {
    lines.push({
      key: "electricity",
      label: "Electricity",
      due: input.electricityCharge,
      paid: 0,
      outstanding: input.electricityCharge,
    });
  }

  return lines;
}

/**
 * Monthly dues per tenancy for a billing month: rent + charges + electricity.
 * Move-in month: no dues. Vacate month: final dues, then omitted next month.
 */
export async function getMonthlyDuesSummary(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<MonthlyDuesSummary> {
  const monthKey = billingMonthKey?.trim() || currentMonthKey();
  const nowKey = currentMonthKey();

  const [tenancyRows, electricityByFlatId, finesByTenancy, ledgerPayments] =
    await Promise.all([
      loadActiveTenancies(supabase),
      loadElectricityDueByFlatId(supabase, monthKey),
      loadFinesDueByTenancy(supabase, monthKey),
      loadRentLedgerPayments(supabase),
    ]);
  const billable = tenancyRows.filter((row) =>
    tenancyIncludedInMonthlyLedger(
      {
        start_date: (row as { start_date?: string | null }).start_date ?? null,
        end_date: (row as { end_date?: string | null }).end_date ?? null,
        status: row.status,
      },
      monthKey
    )
  );

  const paidByTenancy = accumulateMonthPayments(ledgerPayments, monthKey);

  const rows: MonthlyDuesLedgerRow[] = billable
    .map((row) => {
    const tenant = unwrapOne(row.tenants);
    const flat = unwrapOne(row.flats);
    const tenancyDates = {
      start_date: (row as { start_date?: string | null }).start_date ?? null,
      end_date: (row as { end_date?: string | null }).end_date ?? null,
      status: row.status,
    };
    const owesDues = tenancyOwesMonthlyDues(tenancyDates, monthKey);
    const charges = buildTenantMonthlyCharges({
      maintenanceCharge: numOrNull(
        (row as { maintenance_charge?: unknown }).maintenance_charge
      ),
      carParkingCharge: numOrNull(
        (row as { car_parking_charge?: unknown }).car_parking_charge
      ),
      washingMachineCharge: numOrNull(
        (row as { washing_machine_charge?: unknown }).washing_machine_charge
      ),
      otherMonthlyCharge: numOrNull(
        (row as { other_monthly_charge?: unknown }).other_monthly_charge
      ),
      otherChargesNotes:
        ((row as { other_charges_notes?: string | null }).other_charges_notes ??
          null),
      flatMaintenanceFallback: numOrNull(flat?.maintenance_amount),
    });

    const rentDue = owesDues ? num(row.monthly_rent) : 0;
    const maintenanceCharge = owesDues ? charges.maintenanceCharge : 0;
    const carParkingCharge = owesDues ? charges.carParkingCharge : 0;
    const washingMachineCharge = owesDues ? charges.washingMachineCharge : 0;
    const otherMonthlyCharge = owesDues ? charges.otherMonthlyCharge : 0;
    const chargesDue = owesDues ? charges.totalMonthlyCharges : 0;
    const electricityRaw = electricityByFlatId.get(flat?.id ?? "") ?? 0;
    const electricityCharge = owesDues ? electricityRaw : 0;
    const finesCharge = finesByTenancy.get(row.id) ?? 0;
    const lines = buildMonthlyDuesLines({
      rentDue,
      maintenanceCharge,
      carParkingCharge,
      washingMachineCharge,
      otherMonthlyCharge,
      otherChargesNotes: charges.otherChargesNotes,
      finesCharge,
      electricityCharge,
    });
    const totalDue = lines.reduce((sum, line) => sum + line.due, 0);
    const paidInfo = paidByTenancy.get(row.id);
    const rentPaid = paidInfo?.rentPaid ?? 0;
    const chargesPaid = paidInfo?.chargesPaid ?? 0;
    const waivedAmount = paidInfo?.waivedAmount ?? 0;
    const amountPaid = rentPaid + chargesPaid;

    allocatePaymentsAcrossLines(lines, amountPaid + waivedAmount);
    const outstanding = lines.reduce((sum, line) => sum + line.outstanding, 0);

    let status: PaymentStatus = monthCollectionStatus(
      totalDue,
      amountPaid,
      waivedAmount,
      outstanding
    );
    status = applyOverdueIfNeeded(status, monthKey, nowKey);

    return {
      tenancyId: row.id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      billingMonthKey: monthKey,
      startDate: tenancyDates.start_date ?? null,
      rentDue,
      maintenanceCharge,
      carParkingCharge,
      washingMachineCharge,
      otherMonthlyCharge,
      otherChargesNotes: charges.otherChargesNotes,
      chargesDue,
      finesCharge,
      electricityCharge,
      totalDue,
      rentPaid,
      chargesPaid,
      amountPaid,
      outstanding,
      status,
      lastPaymentId: paidInfo?.lastPaymentId ?? null,
      lastReceiptId: paidInfo?.lastReceiptId ?? null,
      lastReceiptNumber: paidInfo?.lastReceiptNumber ?? null,
      lastPaymentDate: paidInfo?.lastPaymentDate ?? null,
    };
  })
    .filter((row) => row.totalDue > 0 || row.amountPaid > 0);

  rows.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));

  const totalExpected = rows.reduce((s, r) => s + r.totalDue, 0);
  const totalCollected = rows.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const collectionRatePercent =
    totalExpected > 0
      ? Math.round((totalCollected / totalExpected) * 100)
      : null;
  const delayedDaysMax = rows.reduce(
    (max, row) => Math.max(max, delayedDaysPastDue(monthKey, row.outstanding)),
    0
  );

  return {
    billingMonthKey: monthKey,
    billingMonthLabel: formatBillingMonthLabel(monthKey),
    totalExpected,
    totalCollected,
    outstanding,
    collectionRatePercent,
    delayedDaysMax,
    paidTenants: rows.filter((r) => r.status === "paid" || r.status === "waived")
      .length,
    pendingTenants: rows.filter(
      (r) => r.status === "pending" || r.status === "overdue"
    ).length,
    partialTenants: rows.filter((r) => r.status === "partial").length,
    overdueTenants: rows.filter((r) => r.status === "overdue").length,
    rows,
  };
}

export function formatMonthlyDuesBreakdown(row: MonthlyDuesLedgerRow): string {
  const parts: string[] = [];
  if (row.rentDue > 0) parts.push(`rent ${row.rentDue}`);
  if (row.maintenanceCharge > 0) {
    parts.push(`maintenance ${row.maintenanceCharge}`);
  }
  if (row.carParkingCharge > 0) {
    parts.push(`parking ${row.carParkingCharge}`);
  }
  if (row.washingMachineCharge > 0) {
    parts.push(`washer ${row.washingMachineCharge}`);
  }
  if (row.otherMonthlyCharge > 0) {
    parts.push(`other ${row.otherMonthlyCharge}`);
  }
  if (row.finesCharge > 0) {
    parts.push(`fines ${row.finesCharge}`);
  }
  if (row.electricityCharge > 0) {
    parts.push(`electricity ${row.electricityCharge}`);
  }
  return parts.length ? parts.join(" + ") : "no monthly charges";
}

async function loadTenancyRowById(supabase: SupabaseClient, tenancyId: string) {
  const full = await supabase
    .from("tenancies")
    .select(TENANCY_SELECT_FULL)
    .eq("id", tenancyId)
    .maybeSingle();
  if (!full.error && full.data) return full.data;

  if (
    full.error &&
    /maintenance_charge|car_parking_charge|washing_machine_charge|other_monthly_charge/i.test(
      full.error.message
    )
  ) {
    const fallback = await supabase
      .from("tenancies")
      .select(TENANCY_SELECT_FALLBACK)
      .eq("id", tenancyId)
      .maybeSingle();
    return fallback.data ?? null;
  }

  return null;
}

/** Single-tenancy dues row, including move-in months with zero due. */
export async function getTenancyMonthlyDueRow(
  supabase: SupabaseClient,
  tenancyId: string,
  billingMonthKey: string
): Promise<MonthlyDuesLedgerRow | null> {
  const monthKey = billingMonthKey.trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;

  const row = await loadTenancyRowById(supabase, tenancyId);
  if (!row) return null;

  const tenancyDates = {
    start_date: (row as { start_date?: string | null }).start_date ?? null,
    end_date: (row as { end_date?: string | null }).end_date ?? null,
    status: row.status,
  };
  if (!tenancyIncludedInMonthlyLedger(tenancyDates, monthKey)) return null;

  const nowKey = currentMonthKey();
  const [electricityByFlatId, finesByTenancy, ledgerPayments] =
    await Promise.all([
      loadElectricityDueByFlatId(supabase, monthKey),
      loadFinesDueByTenancy(supabase, monthKey),
      loadRentLedgerPayments(supabase, { tenancyId }),
    ]);
  const flat = unwrapOne(row.flats);
  const tenant = unwrapOne(row.tenants);
  const paidInfo = accumulateMonthPayments(ledgerPayments, monthKey).get(
    tenancyId
  );

  const owesDues = tenancyOwesMonthlyDues(tenancyDates, monthKey);
  const charges = buildTenantMonthlyCharges({
    maintenanceCharge: numOrNull(
      (row as { maintenance_charge?: unknown }).maintenance_charge
    ),
    carParkingCharge: numOrNull(
      (row as { car_parking_charge?: unknown }).car_parking_charge
    ),
    washingMachineCharge: numOrNull(
      (row as { washing_machine_charge?: unknown }).washing_machine_charge
    ),
    otherMonthlyCharge: numOrNull(
      (row as { other_monthly_charge?: unknown }).other_monthly_charge
    ),
    otherChargesNotes:
      ((row as { other_charges_notes?: string | null }).other_charges_notes ??
        null),
    flatMaintenanceFallback: numOrNull(flat?.maintenance_amount),
  });

  const rentDue = owesDues ? num(row.monthly_rent) : 0;
  const maintenanceCharge = owesDues ? charges.maintenanceCharge : 0;
  const carParkingCharge = owesDues ? charges.carParkingCharge : 0;
  const washingMachineCharge = owesDues ? charges.washingMachineCharge : 0;
  const otherMonthlyCharge = owesDues ? charges.otherMonthlyCharge : 0;
  const chargesDue = owesDues ? charges.totalMonthlyCharges : 0;
  const electricityRaw = electricityByFlatId.get(flat?.id ?? "") ?? 0;
  const electricityCharge = owesDues ? electricityRaw : 0;
  const finesCharge = finesByTenancy.get(tenancyId) ?? 0;
  const lines = buildMonthlyDuesLines({
    rentDue,
    maintenanceCharge,
    carParkingCharge,
    washingMachineCharge,
    otherMonthlyCharge,
    otherChargesNotes: charges.otherChargesNotes,
    finesCharge,
    electricityCharge,
  });
  const totalDue = lines.reduce((sum, line) => sum + line.due, 0);
  const rentPaid = paidInfo?.rentPaid ?? 0;
  const chargesPaid = paidInfo?.chargesPaid ?? 0;
  const waivedAmount = paidInfo?.waivedAmount ?? 0;
  const amountPaid = rentPaid + chargesPaid;

  allocatePaymentsAcrossLines(lines, amountPaid + waivedAmount);
  const outstanding = lines.reduce((sum, line) => sum + line.outstanding, 0);

  let status: PaymentStatus = monthCollectionStatus(
    totalDue,
    amountPaid,
    waivedAmount,
    outstanding
  );
  status = applyOverdueIfNeeded(status, monthKey, nowKey);

  return {
    tenancyId: row.id,
    flatNumber: flat?.flat_number?.trim() || "—",
    tenantName: tenant?.full_name?.trim() || "—",
    billingMonthKey: monthKey,
    startDate: tenancyDates.start_date ?? null,
    rentDue,
    maintenanceCharge,
    carParkingCharge,
    washingMachineCharge,
    otherMonthlyCharge,
    otherChargesNotes: charges.otherChargesNotes,
    chargesDue,
    finesCharge,
    electricityCharge,
    totalDue,
    rentPaid,
    chargesPaid,
    amountPaid,
    outstanding,
    status,
    lastPaymentId: paidInfo?.lastPaymentId ?? null,
    lastReceiptId: paidInfo?.lastReceiptId ?? null,
    lastReceiptNumber: paidInfo?.lastReceiptNumber ?? null,
    lastPaymentDate: paidInfo?.lastPaymentDate ?? null,
  };
}
