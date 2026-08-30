import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allocatePaymentsAcrossLines,
  type DuesBreakdownLine,
} from "@/lib/dues-breakdown";
import { roundElectricityDue } from "@/lib/electricity-billing";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  applyOverdueIfNeeded,
  computePaymentStatus,
  type PaymentStatus,
} from "@/lib/payment-status";
import {
  formatBillingMonthLabel,
  parseBillingMonthFromNotes,
} from "@/lib/receipts";
import { buildTenantMonthlyCharges } from "@/lib/tenant-charges";

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
  rentDue: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  chargesDue: number;
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

async function loadElectricityDueByFlatId(
  supabase: SupabaseClient,
  billingMonthKey: string
): Promise<Map<string, number>> {
  const { data: runs, error: runsError } = await supabase
    .from("electricity_billing_runs")
    .select("id")
    .eq("billing_month", billingMonthKey);

  if (runsError || !runs?.length) return new Map();

  const runIds = runs.map((row) => row.id);
  const { data: readings, error: readingsError } = await supabase
    .from("electricity_readings")
    .select("flat_id, bill_amount")
    .in("billing_run_id", runIds);

  if (readingsError || !readings) return new Map();

  const byFlat = new Map<string, number>();
  for (const row of readings) {
    const bill = roundElectricityDue(num(row.bill_amount));
    if (bill <= 0) continue;
    const flatId = String(row.flat_id);
    byFlat.set(flatId, (byFlat.get(flatId) ?? 0) + bill);
  }
  return byFlat;
}

function buildMonthlyDuesLines(input: {
  rentDue: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
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
 * Monthly dues for active tenancies: rent + monthly charges + electricity.
 * Payments counted: rent + maintenance for the billing month (advance excluded).
 */
export async function getMonthlyDuesSummary(
  supabase: SupabaseClient,
  billingMonthKey?: string
): Promise<MonthlyDuesSummary> {
  const monthKey = billingMonthKey?.trim() || currentMonthKey();
  const nowKey = currentMonthKey();

  const [tenancyRows, electricityByFlatId] = await Promise.all([
    loadActiveTenancies(supabase),
    loadElectricityDueByFlatId(supabase, monthKey),
  ]);
  const active = tenancyRows.filter((row) =>
    isActiveTenancyStatus(row.status)
  );

  const { data: paymentRows } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenancy_id,
      amount_paid,
      status,
      payment_date,
      payment_type,
      notes,
      receipts ( id, receipt_number )
    `
    )
    .in("payment_type", ["rent", "maintenance"]);

  const paidByTenancy = new Map<
    string,
    {
      rentPaid: number;
      chargesPaid: number;
      lastPaymentId: string | null;
      lastPaymentDate: string | null;
      lastReceiptId: string | null;
      lastReceiptNumber: string | null;
      waived: boolean;
    }
  >();

  for (const payment of paymentRows ?? []) {
    const { billingMonthKey: key } = parseBillingMonthFromNotes(payment.notes);
    const effectiveKey =
      key ??
      (typeof payment.payment_date === "string"
        ? payment.payment_date.slice(0, 7)
        : null);
    if (effectiveKey !== monthKey) continue;

    const tenancyId = payment.tenancy_id as string;
    const prev = paidByTenancy.get(tenancyId) ?? {
      rentPaid: 0,
      chargesPaid: 0,
      lastPaymentId: null,
      lastPaymentDate: null,
      lastReceiptId: null,
      lastReceiptNumber: null,
      waived: false,
    };

    const paid = num(payment.amount_paid);
    const type = String(payment.payment_type ?? "rent").toLowerCase();
    if (type === "maintenance") prev.chargesPaid += paid;
    else prev.rentPaid += paid;

    if ((payment.status ?? "").toLowerCase() === "waived") prev.waived = true;

    const receipt = unwrapOne(
      payment.receipts as
        | { id: string; receipt_number: string }
        | { id: string; receipt_number: string }[]
        | null
    );

    const paymentDate = String(payment.payment_date ?? "");
    if (!prev.lastPaymentDate || paymentDate >= prev.lastPaymentDate) {
      prev.lastPaymentId = payment.id;
      prev.lastPaymentDate = paymentDate;
      prev.lastReceiptId = receipt?.id ?? null;
      prev.lastReceiptNumber = receipt?.receipt_number ?? null;
    }

    paidByTenancy.set(tenancyId, prev);
  }

  const rows: MonthlyDuesLedgerRow[] = active.map((row) => {
    const tenant = unwrapOne(row.tenants);
    const flat = unwrapOne(row.flats);
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

    const rentDue = num(row.monthly_rent);
    const chargesDue = charges.totalMonthlyCharges;
    const electricityCharge = electricityByFlatId.get(flat?.id ?? "") ?? 0;
    const lines = buildMonthlyDuesLines({
      rentDue,
      maintenanceCharge: charges.maintenanceCharge,
      carParkingCharge: charges.carParkingCharge,
      washingMachineCharge: charges.washingMachineCharge,
      otherMonthlyCharge: charges.otherMonthlyCharge,
      otherChargesNotes: charges.otherChargesNotes,
      electricityCharge,
    });
    const totalDue = lines.reduce((sum, line) => sum + line.due, 0);
    const paidInfo = paidByTenancy.get(row.id);
    const rentPaid = paidInfo?.rentPaid ?? 0;
    const chargesPaid = paidInfo?.chargesPaid ?? 0;
    const amountPaid = rentPaid + chargesPaid;

    allocatePaymentsAcrossLines(lines, amountPaid);
    const outstanding = lines.reduce((sum, line) => sum + line.outstanding, 0);

    let status: PaymentStatus = paidInfo?.waived
      ? "waived"
      : computePaymentStatus(totalDue, amountPaid);
    status = applyOverdueIfNeeded(status, monthKey, nowKey);

    return {
      tenancyId: row.id,
      flatNumber: flat?.flat_number?.trim() || "—",
      tenantName: tenant?.full_name?.trim() || "—",
      billingMonthKey: monthKey,
      rentDue,
      maintenanceCharge: charges.maintenanceCharge,
      carParkingCharge: charges.carParkingCharge,
      washingMachineCharge: charges.washingMachineCharge,
      otherMonthlyCharge: charges.otherMonthlyCharge,
      otherChargesNotes: charges.otherChargesNotes,
      chargesDue,
      electricityCharge,
      totalDue,
      rentPaid,
      chargesPaid,
      amountPaid,
      outstanding: status === "waived" ? 0 : outstanding,
      status,
      lastPaymentId: paidInfo?.lastPaymentId ?? null,
      lastReceiptId: paidInfo?.lastReceiptId ?? null,
      lastReceiptNumber: paidInfo?.lastReceiptNumber ?? null,
      lastPaymentDate: paidInfo?.lastPaymentDate ?? null,
    };
  });

  rows.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber));

  const totalExpected = rows.reduce((s, r) => s + r.totalDue, 0);
  const totalCollected = rows.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return {
    billingMonthKey: monthKey,
    billingMonthLabel: formatBillingMonthLabel(monthKey),
    totalExpected,
    totalCollected,
    outstanding,
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
  if (row.electricityCharge > 0) {
    parts.push(`electricity ${row.electricityCharge}`);
  }
  return parts.length ? parts.join(" + ") : "no monthly charges";
}
