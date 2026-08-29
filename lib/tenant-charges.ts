export type TenantMonthlyCharges = {
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  totalMonthlyCharges: number;
};

export function buildTenantMonthlyCharges(input: {
  maintenanceCharge?: number | null;
  carParkingCharge?: number | null;
  washingMachineCharge?: number | null;
  otherMonthlyCharge?: number | null;
  otherChargesNotes?: string | null;
  flatMaintenanceFallback?: number | null;
}): TenantMonthlyCharges {
  const maintenanceCharge =
    input.maintenanceCharge != null
      ? input.maintenanceCharge
      : input.flatMaintenanceFallback ?? 0;
  const carParkingCharge = input.carParkingCharge ?? 0;
  const washingMachineCharge = input.washingMachineCharge ?? 0;
  const otherMonthlyCharge = input.otherMonthlyCharge ?? 0;

  return {
    maintenanceCharge,
    carParkingCharge,
    washingMachineCharge,
    otherMonthlyCharge,
    otherChargesNotes: input.otherChargesNotes?.trim() || null,
    totalMonthlyCharges:
      maintenanceCharge +
      carParkingCharge +
      washingMachineCharge +
      otherMonthlyCharge,
  };
}
