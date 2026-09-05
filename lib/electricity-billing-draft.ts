import type { BuildingWing } from "@/lib/building-wing";
import type { ElectricityBillingOccupancyKind } from "@/lib/electricity-occupancy";

export type ElectricityBillingDraftFlatRow = {
  flatId: string;
  flatNumber: string;
  tenantName: string;
  previousReading: string;
  currentReading: string;
  sanctionedKw: string;
  included: boolean;
  occupancyNote?: string;
  occupancyKind?: ElectricityBillingOccupancyKind;
  isManual?: boolean;
};

export type ElectricityBillingDraftWingMeter = {
  buildingPrevious: string;
  buildingCurrent: string;
  buildingSanctionedKw: string;
  buildingBillAmount: string;
};

export type ElectricityBillingDraft = {
  version: 1;
  billingMonth: string;
  readingDate: string;
  ratePerUnit: string;
  basicChargePerKw: string;
  serviceChargePercent: string;
  wingMeters: Record<BuildingWing, ElectricityBillingDraftWingMeter>;
  flatRowsByWing: Record<BuildingWing, ElectricityBillingDraftFlatRow[]>;
  savedAt: string;
};

const STORAGE_PREFIX = "electricity-billing-draft:v1:";

export function electricityBillingDraftKey(billingMonth: string): string {
  return `${STORAGE_PREFIX}${billingMonth.replace("/", "-")}`;
}

export function loadElectricityBillingDraft(
  billingMonth: string
): ElectricityBillingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      electricityBillingDraftKey(billingMonth)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ElectricityBillingDraft;
    if (parsed.version !== 1 || parsed.billingMonth !== billingMonth) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveElectricityBillingDraft(draft: ElectricityBillingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      electricityBillingDraftKey(draft.billingMonth),
      JSON.stringify(draft)
    );
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearElectricityBillingDraft(billingMonth: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(electricityBillingDraftKey(billingMonth));
  } catch {
    // ignore
  }
}
