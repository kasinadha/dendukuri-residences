/** Shared occupancy / tenancy status rules for dashboard + inventory. */

export function isActiveTenancyStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  // "confirmed" = reserved / not yet moved in — NOT current occupancy.
  return value === "active" || value === "occupied" || value === "";
}

export function isOccupiedFlatStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  // "reserved" is inventory hold — NOT occupied for rent expected.
  return value === "occupied" || value === "active" || value === "rented";
}

export function isReservedFlatStatus(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "reserved";
}

export type OccupancyKind = "occupied" | "vacant" | "reserved";

export function occupancyLabel(
  isOccupied: boolean,
  flatStatus?: string | null
): OccupancyKind {
  if (isOccupied) return "occupied";
  if (isReservedFlatStatus(flatStatus)) return "reserved";
  return "vacant";
}

/** Rent expected only from currently occupied units. */
export function contributesToRentExpected(input: {
  isOccupied: boolean;
  rent: number | null;
}): boolean {
  return input.isOccupied && input.rent != null;
}
