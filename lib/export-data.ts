import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import { rowsToCsv, type CsvRow } from "@/lib/csv";
import { expenseBuildingWingLabel } from "@/lib/expense-location";
import { listFlatsForAdmin } from "@/lib/flats";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { listOperationalExpenses } from "@/lib/operational-expenses";
import { listWaterTankers } from "@/lib/ops";
import { parseBillingMonthFromNotes } from "@/lib/receipts";

export const EXPORT_DATASETS = [
  "flats",
  "payments",
  "receipts",
  "tenancies",
  "expenses",
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export type ExportFilters = {
  dataset: ExportDataset;
  building?: BuildingWing | "all";
  flat?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  billingMonth?: string | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function matchesBuilding(
  flatNumber: string | null | undefined,
  building: BuildingWing | "all"
): boolean {
  if (building === "all") return true;
  return buildingWingFromFlatNumber(flatNumber) === building;
}

function matchesFlat(
  flatNumber: string | null | undefined,
  flatFilter: string | null | undefined
): boolean {
  if (!flatFilter?.trim()) return true;
  return (flatNumber ?? "")
    .trim()
    .toUpperCase()
    .includes(flatFilter.trim().toUpperCase());
}

function matchesDateRange(
  isoDate: string | null | undefined,
  fromDate?: string | null,
  toDate?: string | null
): boolean {
  if (!fromDate && !toDate) return true;
  if (!isoDate) return false;
  const day = isoDate.slice(0, 10);
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

function matchesBillingMonth(
  billingMonthKey: string | null | undefined,
  billingMonth?: string | null
): boolean {
  if (!billingMonth?.trim()) return true;
  return billingMonthKey === billingMonth.trim();
}

export function parseExportFilters(
  searchParams: URLSearchParams
): ExportFilters | { error: string } {
  const datasetRaw = searchParams.get("dataset")?.trim().toLowerCase() ?? "payments";
  if (!EXPORT_DATASETS.includes(datasetRaw as ExportDataset)) {
    return { error: "Invalid dataset." };
  }

  const buildingRaw = searchParams.get("building")?.trim().toUpperCase() ?? "ALL";
  const building =
    buildingRaw === "C" || buildingRaw === "D" ? buildingRaw : ("all" as const);

  const fromDate = searchParams.get("from")?.trim() || null;
  const toDate = searchParams.get("to")?.trim() || null;
  const billingMonth = searchParams.get("month")?.trim() || null;
  const flat = searchParams.get("flat")?.trim() || null;

  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return { error: "From date must be YYYY-MM-DD." };
  }
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return { error: "To date must be YYYY-MM-DD." };
  }
  if (billingMonth && !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return { error: "Billing month must be YYYY-MM." };
  }

  return {
    dataset: datasetRaw as ExportDataset,
    building,
    flat,
    fromDate,
    toDate,
    billingMonth,
  };
}

async function exportFlats(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<CsvRow[]> {
  const flats = await listFlatsForAdmin(supabase);
  return flats
    .filter(
      (flat) =>
        matchesBuilding(flat.flatNumber, filters.building ?? "all") &&
        matchesFlat(flat.flatNumber, filters.flat)
    )
    .map((flat) => ({
      flat_number: flat.flatNumber,
      building: buildingWingLabel(buildingWingFromFlatNumber(flat.flatNumber)),
      flat_type: flat.type,
      floor: flat.floor,
      status: flat.status,
      occupancy: flat.occupancy,
      tenant_name: flat.tenantName,
      monthly_rent: flat.rent,
      deposit: flat.deposit,
      maintenance_amount: flat.maintenanceAmount,
      upi_id: flat.upiId,
      property: flat.propertyName,
      notes: flat.notes,
    }));
}

async function exportPayments(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<CsvRow[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      payment_date,
      amount_paid,
      amount_due,
      payment_mode,
      payment_type,
      transaction_reference,
      status,
      notes,
      tenancies (
        tenants ( full_name ),
        flats ( flat_number )
      ),
      receipts ( receipt_number ),
      payment_accounts ( label )
    `
    )
    .order("payment_date", { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  return data
    .map((row) => {
      const tenancy = unwrapOne(row.tenancies);
      const tenant = unwrapOne(tenancy?.tenants ?? null);
      const flat = unwrapOne(tenancy?.flats ?? null);
      const receipt = unwrapOne(row.receipts);
      const account = unwrapOne(row.payment_accounts);
      const flatNumber = flat?.flat_number?.trim() || "";
      const { billingMonthKey } = parseBillingMonthFromNotes(row.notes);

      return {
        row,
        flatNumber,
        billingMonthKey,
        csv: {
          payment_date: row.payment_date,
          billing_month: billingMonthKey,
          flat_number: flatNumber || "—",
          building: buildingWingLabel(buildingWingFromFlatNumber(flatNumber)),
          tenant_name: tenant?.full_name?.trim() || "—",
          amount_paid: row.amount_paid,
          amount_due: row.amount_due,
          status: row.status,
          payment_mode: row.payment_mode,
          payment_type: row.payment_type,
          transaction_reference: row.transaction_reference,
          receipt_number: receipt?.receipt_number ?? "",
          received_into: account?.label ?? "",
          notes: row.notes,
        } satisfies CsvRow,
      };
    })
    .filter(({ flatNumber, billingMonthKey, row }) => {
      if (!matchesBuilding(flatNumber, filters.building ?? "all")) return false;
      if (!matchesFlat(flatNumber, filters.flat)) return false;
      if (!matchesDateRange(row.payment_date, filters.fromDate, filters.toDate)) {
        return false;
      }
      if (!matchesBillingMonth(billingMonthKey, filters.billingMonth)) return false;
      return true;
    })
    .map(({ csv }) => csv);
}

async function exportReceipts(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<CsvRow[]> {
  const { data, error } = await supabase
    .from("receipts")
    .select(
      `
      id,
      receipt_number,
      created_at,
      payments (
        payment_date,
        amount_paid,
        amount_due,
        payment_mode,
        transaction_reference,
        notes,
        tenancies (
          tenants ( full_name ),
          flats ( flat_number )
        )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  return data
    .map((row) => {
      const payment = unwrapOne(row.payments);
      const tenancy = unwrapOne(payment?.tenancies ?? null);
      const tenant = unwrapOne(tenancy?.tenants ?? null);
      const flat = unwrapOne(tenancy?.flats ?? null);
      const flatNumber = flat?.flat_number?.trim() || "";
      const { billingMonthKey } = parseBillingMonthFromNotes(payment?.notes ?? null);

      return {
        paymentDate: payment?.payment_date ?? row.created_at,
        flatNumber,
        billingMonthKey,
        csv: {
          receipt_number: row.receipt_number,
          receipt_created_at: row.created_at,
          payment_date: payment?.payment_date ?? "",
          billing_month: billingMonthKey,
          flat_number: flatNumber || "—",
          building: buildingWingLabel(buildingWingFromFlatNumber(flatNumber)),
          tenant_name: tenant?.full_name?.trim() || "—",
          amount_paid: payment?.amount_paid ?? "",
          amount_due: payment?.amount_due ?? "",
          payment_mode: payment?.payment_mode ?? "",
          transaction_reference: payment?.transaction_reference ?? "",
        } satisfies CsvRow,
      };
    })
    .filter(({ paymentDate, flatNumber, billingMonthKey }) => {
      if (!matchesBuilding(flatNumber, filters.building ?? "all")) return false;
      if (!matchesFlat(flatNumber, filters.flat)) return false;
      if (!matchesDateRange(paymentDate, filters.fromDate, filters.toDate)) {
        return false;
      }
      if (!matchesBillingMonth(billingMonthKey, filters.billingMonth)) return false;
      return true;
    })
    .map(({ csv }) => csv);
}

async function exportTenancies(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<CsvRow[]> {
  const { data, error } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      security_deposit,
      deposit_amount,
      deposit_paid,
      start_date,
      end_date,
      created_at,
      notes,
      tenants ( full_name, phone ),
      flats ( flat_number, flat_type, floor )
    `
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  return data
    .map((row) => {
      const tenant = unwrapOne(row.tenants);
      const flat = unwrapOne(row.flats);
      const flatNumber = flat?.flat_number?.trim() || "";

      return {
        createdAt: row.created_at ?? row.start_date,
        flatNumber,
        csv: {
          flat_number: flatNumber || "—",
          building: buildingWingLabel(buildingWingFromFlatNumber(flatNumber)),
          flat_type: flat?.flat_type ?? "",
          floor: flat?.floor ?? "",
          tenant_name: tenant?.full_name?.trim() || "—",
          tenant_phone: tenant?.phone ?? "",
          status: row.status,
          monthly_rent: row.monthly_rent,
          security_deposit: row.security_deposit,
          deposit_amount: row.deposit_amount,
          deposit_paid: row.deposit_paid,
          start_date: row.start_date,
          end_date: row.end_date,
          created_at: row.created_at,
          notes: row.notes,
        } satisfies CsvRow,
      };
    })
    .filter(({ createdAt, flatNumber }) => {
      if (!matchesBuilding(flatNumber, filters.building ?? "all")) return false;
      if (!matchesFlat(flatNumber, filters.flat)) return false;
      if (!matchesDateRange(createdAt, filters.fromDate, filters.toDate)) {
        return false;
      }
      return true;
    })
    .map(({ csv }) => csv);
}

async function exportExpenses(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<CsvRow[]> {
  const [tankers, maintenance, otherExpenses] = await Promise.all([
    listWaterTankers(supabase),
    listMaintenanceRequests(supabase, { limit: 5000 }),
    listOperationalExpenses(supabase, { limit: 5000 }),
  ]);

  const tankerRows: CsvRow[] = tankers
    .filter((row) => {
      if (row.flatNumber) {
        if (!matchesBuilding(row.flatNumber, filters.building ?? "all")) {
          return false;
        }
        if (!matchesFlat(row.flatNumber, filters.flat)) return false;
      } else if (row.buildingWing && row.buildingWing !== "shared") {
        if (
          filters.building &&
          filters.building !== "all" &&
          row.buildingWing !== filters.building
        ) {
          return false;
        }
      }
      if (!matchesDateRange(row.deliveryDate, filters.fromDate, filters.toDate)) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      expense_type: "water_tanker",
      date: row.deliveryDate,
      flat_number: row.flatNumber ?? "",
      building: row.flatNumber
        ? buildingWingLabel(buildingWingFromFlatNumber(row.flatNumber))
        : expenseBuildingWingLabel(row.buildingWing),
      description: row.vendorName ?? "Water tanker",
      amount: row.amount,
      payment_status: row.paymentStatus,
      paid_by: row.payerAccountLabel ?? "",
      notes: row.notes,
    }));

  const maintenanceRows: CsvRow[] = maintenance
    .filter((row) => {
      if (!matchesBuilding(row.flatNumber, filters.building ?? "all")) return false;
      if (!matchesFlat(row.flatNumber, filters.flat)) return false;
      if (!matchesDateRange(row.createdAt, filters.fromDate, filters.toDate)) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      expense_type: "maintenance",
      date: row.createdAt.slice(0, 10),
      flat_number: row.flatNumber,
      building: buildingWingLabel(buildingWingFromFlatNumber(row.flatNumber)),
      description: row.title,
      amount: row.cost,
      payment_status: row.status,
      paid_by: row.payerAccountLabel ?? "",
      notes: row.description,
    }));

  const otherRows: CsvRow[] = otherExpenses
    .filter((row) => {
      const flatNumber = row.flatNumber ?? "";
      if (flatNumber) {
        if (!matchesBuilding(flatNumber, filters.building ?? "all")) return false;
        if (!matchesFlat(flatNumber, filters.flat)) return false;
      } else if (row.buildingWing && row.buildingWing !== "shared") {
        if (
          filters.building &&
          filters.building !== "all" &&
          row.buildingWing !== filters.building
        ) {
          return false;
        }
      }
      if (!matchesDateRange(row.expenseDate, filters.fromDate, filters.toDate)) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      expense_type: "other",
      date: row.expenseDate,
      flat_number: row.flatNumber ?? "",
      building: row.flatNumber
        ? buildingWingLabel(buildingWingFromFlatNumber(row.flatNumber))
        : expenseBuildingWingLabel(row.buildingWing),
      description: row.title,
      amount: row.amount,
      payment_status: "recorded",
      paid_by: row.payerAccountLabel ?? "",
      notes: row.notes,
    }));

  return [...tankerRows, ...maintenanceRows, ...otherRows];
}

export async function buildExportCsv(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<{ filename: string; csv: string; rowCount: number }> {
  let rows: CsvRow[] = [];

  switch (filters.dataset) {
    case "flats":
      rows = await exportFlats(supabase, filters);
      break;
    case "payments":
      rows = await exportPayments(supabase, filters);
      break;
    case "receipts":
      rows = await exportReceipts(supabase, filters);
      break;
    case "tenancies":
      rows = await exportTenancies(supabase, filters);
      break;
    case "expenses":
      rows = await exportExpenses(supabase, filters);
      break;
  }

  const parts = ["dendukuri", filters.dataset];
  if (filters.building && filters.building !== "all") {
    parts.push(`building-${filters.building.toLowerCase()}`);
  }
  if (filters.flat) {
    parts.push(filters.flat.toLowerCase());
  }
  if (filters.billingMonth) {
    parts.push(filters.billingMonth);
  } else if (filters.fromDate || filters.toDate) {
    parts.push(filters.fromDate ?? "start", filters.toDate ?? "end");
  }

  return {
    filename: `${parts.join("-")}.csv`,
    csv: rowsToCsv(rows),
    rowCount: rows.length,
  };
}
