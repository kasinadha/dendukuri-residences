import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";

export type ExpenseBuildingWing = BuildingWing | "shared";

export type FlatLocationOption = {
  id: string;
  label: string;
  flatNumber: string;
  building: BuildingWing | null;
};

export function parseExpenseBuildingWing(
  value: string | null | undefined
): ExpenseBuildingWing | null {
  const trimmed = value?.trim().toUpperCase() ?? "";
  if (trimmed === "C" || trimmed === "D") return trimmed;
  if (trimmed === "SHARED" || trimmed === "BOTH") return "shared";
  return null;
}

export function expenseBuildingWingLabel(
  wing: ExpenseBuildingWing | null | undefined
): string {
  if (wing === "shared") return "Shared / both buildings";
  return buildingWingLabel(wing ?? null);
}

export function formatExpenseLocation(input: {
  buildingWing?: ExpenseBuildingWing | null;
  flatNumber?: string | null;
}): string {
  const flatNumber = input.flatNumber?.trim() || null;
  const wing =
    input.buildingWing ??
    (flatNumber ? buildingWingFromFlatNumber(flatNumber) : null);

  if (flatNumber) {
    const building = buildingWingLabel(
      wing && wing !== "shared" ? wing : buildingWingFromFlatNumber(flatNumber)
    );
    return `${building} · Flat ${flatNumber}`;
  }

  return expenseBuildingWingLabel(wing);
}

export function filterFlatsByBuilding(
  flats: FlatLocationOption[],
  building: ExpenseBuildingWing | "all" | ""
): FlatLocationOption[] {
  if (!building || building === "all" || building === "shared") {
    return flats;
  }
  return flats.filter((flat) => flat.building === building);
}
