"use client";

import { useMemo, useState } from "react";
import {
  expenseBuildingWingLabel,
  filterFlatsByBuilding,
  type ExpenseBuildingWing,
  type FlatLocationOption,
} from "@/lib/expense-location";

type Props = {
  flats: FlatLocationOption[];
  buildingName?: string;
  flatName?: string;
  includeShared?: boolean;
  buildingRequired?: boolean;
  flatRequired?: boolean;
  flatHint?: string;
  defaultBuilding?: ExpenseBuildingWing | "";
};

export default function ExpenseLocationFields({
  flats,
  buildingName = "building_wing",
  flatName = "flat_id",
  includeShared = true,
  buildingRequired = true,
  flatRequired = false,
  flatHint = "Optional — leave blank for whole-building or common area.",
  defaultBuilding = "",
}: Props) {
  const [building, setBuilding] = useState<ExpenseBuildingWing | "">(
    defaultBuilding
  );

  const filteredFlats = useMemo(
    () => filterFlatsByBuilding(flats, building),
    [flats, building]
  );

  return (
    <>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Building
        </span>
        <select
          name={buildingName}
          required={buildingRequired}
          value={building}
          onChange={(event) =>
            setBuilding(event.target.value as ExpenseBuildingWing | "")
          }
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="">Select building</option>
          <option value="C">Building C</option>
          <option value="D">Building D</option>
          {includeShared ? (
            <option value="shared">Shared / both buildings</option>
          ) : null}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Flat
        </span>
        <select
          name={flatName}
          required={flatRequired}
          disabled={flats.length === 0}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          defaultValue=""
        >
          <option value="">
            {flatRequired ? "Select flat" : "Not flat-specific"}
          </option>
          {filteredFlats.map((flat) => (
            <option key={flat.id} value={flat.id}>
              {flat.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          {building
            ? `${expenseBuildingWingLabel(building)}${
                flatRequired ? "" : ` · ${flatHint}`
              }`
            : flatHint}
        </span>
      </label>
    </>
  );
}
