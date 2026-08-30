import { isActiveTenancyStatus, isEndedTenancyStatus } from "@/lib/occupancy";
import { formatDisplayDate } from "@/lib/receipts";

export type ElectricityBillingOccupancyKind =
  | "current"
  | "moved_in"
  | "vacated"
  | "tenant_change"
  | "manual";

export type TenancyForBillingOverlap = {
  start_date: string | null;
  end_date: string | null;
  status: string | null;
};

export function billingMonthDateRange(monthKey: string): {
  start: string;
  end: string;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    throw new Error(`Invalid billing month: ${monthKey}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid billing month: ${monthKey}`);
  }
  const start = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function dateRangesOverlap(
  tenancyStart: string,
  tenancyEnd: string | null,
  monthStart: string,
  monthEnd: string
): boolean {
  const end = tenancyEnd ?? "9999-12-31";
  return tenancyStart <= monthEnd && end >= monthStart;
}

function isExcludedTenancyStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "cancelled" || value === "rejected";
}

/** Whether a tenancy should appear on an electricity bill for the given month. */
export function tenancyOverlapsBillingMonth(
  tenancy: TenancyForBillingOverlap,
  billingMonthKey: string
): boolean {
  if (isExcludedTenancyStatus(tenancy.status)) return false;

  const { start: monthStart, end: monthEnd } =
    billingMonthDateRange(billingMonthKey);
  const status = (tenancy.status ?? "").toLowerCase();

  if (isEndedTenancyStatus(tenancy.status)) {
    const endDate = tenancy.end_date?.trim();
    if (!endDate) return false;
    const start = tenancy.start_date?.trim() || endDate;
    return dateRangesOverlap(start, endDate, monthStart, monthEnd);
  }

  if (status === "confirmed" && tenancy.start_date) {
    return (
      tenancy.start_date >= monthStart && tenancy.start_date <= monthEnd
    );
  }

  if (!tenancy.start_date) {
    return isActiveTenancyStatus(tenancy.status);
  }

  return dateRangesOverlap(
    tenancy.start_date,
    tenancy.end_date,
    monthStart,
    monthEnd
  );
}

type TenancyOccupancyInput = TenancyForBillingOverlap & {
  tenantName: string;
};

export function describeFlatBillingOccupancy(
  tenancies: TenancyOccupancyInput[],
  billingMonthKey: string
): {
  tenantName: string;
  occupancyKind: ElectricityBillingOccupancyKind;
  occupancyNote: string;
} {
  const { start: monthStart, end: monthEnd } =
    billingMonthDateRange(billingMonthKey);

  const sorted = [...tenancies].sort((a, b) =>
    (a.start_date ?? "").localeCompare(b.start_date ?? "")
  );

  if (sorted.length === 0) {
    return {
      tenantName: "—",
      occupancyKind: "current",
      occupancyNote: "",
    };
  }

  if (sorted.length > 1) {
    const names = sorted
      .map((t) => t.tenantName.trim())
      .filter(Boolean)
      .join(" → ");
    return {
      tenantName: names || sorted[sorted.length - 1]?.tenantName || "Tenant",
      occupancyKind: "tenant_change",
      occupancyNote: "Tenant changed during this month",
    };
  }

  const tenancy = sorted[0]!;
  const tenantName = tenancy.tenantName.trim() || "Tenant";
  const start = tenancy.start_date;
  const end = tenancy.end_date;

  if (start && start > monthStart && start <= monthEnd) {
    return {
      tenantName,
      occupancyKind: "moved_in",
      occupancyNote: `Moved in ${formatDisplayDate(start)}`,
    };
  }

  if (end && end >= monthStart && end < monthEnd) {
    return {
      tenantName,
      occupancyKind: "vacated",
      occupancyNote: `Vacated ${formatDisplayDate(end)}`,
    };
  }

  if (isActiveTenancyStatus(tenancy.status)) {
    return {
      tenantName,
      occupancyKind: "current",
      occupancyNote: "",
    };
  }

  return {
    tenantName,
    occupancyKind: "current",
    occupancyNote: "Occupied during this month",
  };
}
