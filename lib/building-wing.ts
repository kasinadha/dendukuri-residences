export type BuildingWing = "C" | "D";

/** Building wing from flat number prefix (C101 → C, D201 → D). */
export function buildingWingFromFlatNumber(
  flatNumber: string | null | undefined
): BuildingWing | null {
  const trimmed = flatNumber?.trim().toUpperCase() ?? "";
  if (trimmed.startsWith("C")) return "C";
  if (trimmed.startsWith("D")) return "D";
  return null;
}

export function buildingWingLabel(wing: BuildingWing | null): string {
  if (wing === "C") return "Building C";
  if (wing === "D") return "Building D";
  return "Other";
}
