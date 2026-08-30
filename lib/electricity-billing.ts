export type ElectricityBillingConfig = {
  ratePerUnit: number;
  basicChargePerKw: number;
  serviceChargePercent: number;
  defaultFlatSanctionedKw: number;
};

export const DEFAULT_ELECTRICITY_BILLING_CONFIG: ElectricityBillingConfig = {
  ratePerUnit: 8,
  basicChargePerKw: 120,
  serviceChargePercent: 9,
  defaultFlatSanctionedKw: 2,
};

export type FlatElectricityBillBreakdown = {
  flatUnits: number;
  commonShareUnits: number;
  energyUnitsTotal: number;
  energyCharge: number;
  basicCharge: number;
  subtotalBeforeService: number;
  serviceCharge: number;
  totalDue: number;
};

export function basicChargeForSanctionedKw(
  sanctionedKw: number,
  config: ElectricityBillingConfig = DEFAULT_ELECTRICITY_BILLING_CONFIG
): number {
  if (!Number.isFinite(sanctionedKw) || sanctionedKw <= 0) return 0;
  return config.basicChargePerKw * sanctionedKw;
}

/**
 * Per-flat bill:
 * ((flat units + common share) × rate per unit) + service % on energy only
 * + basic charge per kW × sanctioned kW
 */
export function calculateFlatElectricityBill(input: {
  flatUnits: number;
  commonShareUnits: number;
  sanctionedKw?: number;
  config?: ElectricityBillingConfig;
}): FlatElectricityBillBreakdown {
  const config = input.config ?? DEFAULT_ELECTRICITY_BILLING_CONFIG;
  const flatUnits = Math.max(0, input.flatUnits);
  const commonShareUnits = Math.max(0, input.commonShareUnits);
  const sanctionedKw = input.sanctionedKw ?? config.defaultFlatSanctionedKw;

  const energyUnitsTotal = flatUnits + commonShareUnits;
  const energyCharge = energyUnitsTotal * config.ratePerUnit;
  const basicCharge = basicChargeForSanctionedKw(sanctionedKw, config);
  const serviceCharge =
    energyCharge * (config.serviceChargePercent / 100);
  const subtotalBeforeService = energyCharge + serviceCharge;
  const totalDue = subtotalBeforeService + basicCharge;

  return {
    flatUnits,
    commonShareUnits,
    energyUnitsTotal,
    energyCharge: roundMoney(energyCharge),
    basicCharge: roundMoney(basicCharge),
    subtotalBeforeService: roundMoney(subtotalBeforeService),
    serviceCharge: roundMoney(serviceCharge),
    totalDue: roundMoney(totalDue),
  };
}

export function calculateCommonAreaUnits(input: {
  buildingUnits: number;
  totalFlatUnits: number;
}): number {
  return Math.max(0, input.buildingUnits - input.totalFlatUnits);
}

export function calculateCommonSharePerFlat(input: {
  commonAreaUnits: number;
  occupiedFlatsCount: number;
}): number {
  const count = Math.max(1, input.occupiedFlatsCount);
  return input.commonAreaUnits / count;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatElectricityFormulaSummary(
  breakdown: FlatElectricityBillBreakdown,
  config: ElectricityBillingConfig = DEFAULT_ELECTRICITY_BILLING_CONFIG
): string {
  return `((${breakdown.flatUnits} + ${roundDisplay(breakdown.commonShareUnits)} units) × ₹${config.ratePerUnit}) + ${config.serviceChargePercent}% service + basic ₹${config.basicChargePerKw}/kW`;
}

function roundDisplay(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
