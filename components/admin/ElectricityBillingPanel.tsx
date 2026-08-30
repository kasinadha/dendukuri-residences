"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fetchFlatsForElectricityBillingAction,
  generateElectricityBillingAction,
} from "@/app/admin/electricity/actions";
import { buildingWingLabel, type BuildingWing } from "@/lib/building-wing";
import {
  DEFAULT_ELECTRICITY_BILLING_CONFIG,
  formatElectricityFormulaSummary,
} from "@/lib/electricity-billing";
import type { ElectricityBillingOccupancyKind } from "@/lib/electricity-occupancy";
import {
  previewElectricityBills,
  type FlatOption,
  type OccupiedFlatForBilling,
} from "@/lib/electricity";
import { formatInr } from "@/lib/receipts";

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentBillingMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

type FlatReadingState = {
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

type WingMeterState = {
  buildingPrevious: string;
  buildingCurrent: string;
  buildingSanctionedKw: string;
  buildingBillAmount: string;
};

function emptyWingMeter(lastReading: number | null): WingMeterState {
  return {
    buildingPrevious: lastReading != null ? String(lastReading) : "",
    buildingCurrent: "",
    buildingSanctionedKw: "14",
    buildingBillAmount: "",
  };
}

function flatToRow(
  flat: OccupiedFlatForBilling,
  previous?: FlatReadingState
): FlatReadingState {
  return {
    flatId: flat.flatId,
    flatNumber: flat.flatNumber,
    tenantName: flat.tenantName,
    previousReading: previous?.previousReading ?? String(flat.previousReading),
    currentReading: previous?.currentReading ?? "",
    sanctionedKw: previous?.sanctionedKw ?? String(flat.sanctionedKw),
    included: previous?.included ?? true,
    occupancyNote: flat.occupancyNote,
    occupancyKind: flat.occupancyKind,
    isManual: previous?.isManual,
  };
}

function rowsForWing(
  flats: OccupiedFlatForBilling[],
  wing: BuildingWing,
  previousRows: FlatReadingState[]
): FlatReadingState[] {
  const prevById = new Map(previousRows.map((row) => [row.flatId, row]));
  const manualRows = previousRows.filter(
    (row) => row.isManual && !flats.some((flat) => flat.flatId === row.flatId)
  );

  const fromTenancy = flats
    .filter((flat) => flat.buildingWing === wing)
    .map((flat) => flatToRow(flat, prevById.get(flat.flatId)));

  const manualInWing = manualRows.filter((row) => {
    const wingFromNumber =
      row.flatNumber.startsWith("C") ? "C" : row.flatNumber.startsWith("D") ? "D" : null;
    return wingFromNumber === wing;
  });

  return [...fromTenancy, ...manualInWing].sort((a, b) =>
    a.flatNumber.localeCompare(b.flatNumber)
  );
}

function occupancyBadge(kind?: ElectricityBillingOccupancyKind): string | null {
  switch (kind) {
    case "moved_in":
      return "Move-in";
    case "vacated":
      return "Vacated";
    case "tenant_change":
      return "Tenant change";
    case "manual":
      return "Manual";
    default:
      return null;
  }
}

type Props = {
  occupiedFlats: OccupiedFlatForBilling[];
  lastBuildingReadings: { C: number | null; D: number | null };
};

export default function ElectricityBillingPanel({
  occupiedFlats,
  lastBuildingReadings,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeWing, setActiveWing] = useState<BuildingWing>("C");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [readingDate, setReadingDate] = useState(todayIsoDate());
  const [allFlats, setAllFlats] = useState<FlatOption[]>([]);
  const [lastReadingsByFlatId, setLastReadingsByFlatId] = useState<
    Record<string, number>
  >({});
  const [ratePerUnit, setRatePerUnit] = useState(
    String(DEFAULT_ELECTRICITY_BILLING_CONFIG.ratePerUnit)
  );
  const [basicChargePerKw, setBasicChargePerKw] = useState(
    String(DEFAULT_ELECTRICITY_BILLING_CONFIG.basicChargePerKw)
  );
  const [serviceChargePercent, setServiceChargePercent] = useState(
    String(DEFAULT_ELECTRICITY_BILLING_CONFIG.serviceChargePercent)
  );

  const [wingMeters, setWingMeters] = useState<Record<BuildingWing, WingMeterState>>(
    () => ({
      C: emptyWingMeter(lastBuildingReadings.C),
      D: emptyWingMeter(lastBuildingReadings.D),
    })
  );

  const [flatRowsByWing, setFlatRowsByWing] = useState<
    Record<BuildingWing, FlatReadingState[]>
  >(() => ({
    C: rowsForWing(occupiedFlats, "C", []),
    D: rowsForWing(occupiedFlats, "D", []),
  }));

  const flatRows = flatRowsByWing[activeWing];
  const includedFlatRows = flatRows.filter((row) => row.included);
  const wingMeter = wingMeters[activeWing];
  const { buildingPrevious, buildingCurrent, buildingSanctionedKw, buildingBillAmount } =
    wingMeter;

  useEffect(() => {
    let cancelled = false;
    setLoadingFlats(true);

    fetchFlatsForElectricityBillingAction(billingMonth)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setAllFlats(result.allFlats);
        setLastReadingsByFlatId(result.lastReadingsByFlatId);
        setFlatRowsByWing((current) => ({
          C: rowsForWing(result.flats, "C", current.C),
          D: rowsForWing(result.flats, "D", current.D),
        }));
      })
      .finally(() => {
        if (!cancelled) setLoadingFlats(false);
      });

    return () => {
      cancelled = true;
    };
  }, [billingMonth]);

  const addableFlats = useMemo(() => {
    const listed = new Set(flatRows.map((row) => row.flatId));
    return allFlats.filter(
      (flat) =>
        flat.building === activeWing && !listed.has(flat.id)
    );
  }, [allFlats, activeWing, flatRows]);

  function updateWingMeter(wing: BuildingWing, patch: Partial<WingMeterState>) {
    setWingMeters((current) => ({
      ...current,
      [wing]: { ...current[wing], ...patch },
    }));
  }

  function updateFlatRow(
    flatId: string,
    patch: Partial<FlatReadingState>
  ): void {
    setFlatRowsByWing((current) => ({
      ...current,
      [activeWing]: current[activeWing].map((row) =>
        row.flatId === flatId ? { ...row, ...patch } : row
      ),
    }));
  }

  function addFlatForMonth(flatId: string) {
    const flat = allFlats.find((item) => item.id === flatId);
    if (!flat) return;

    setFlatRowsByWing((current) => {
      if (current[activeWing].some((row) => row.flatId === flatId)) {
        return current;
      }
      const nextRow: FlatReadingState = {
        flatId: flat.id,
        flatNumber: flat.flatNumber,
        tenantName: "—",
        previousReading: String(lastReadingsByFlatId[flat.id] ?? 0),
        currentReading: "",
        sanctionedKw: "2",
        included: true,
        isManual: true,
        occupancyKind: "manual",
        occupancyNote: "Added for this billing month",
      };
      return {
        ...current,
        [activeWing]: [...current[activeWing], nextRow].sort((a, b) =>
          a.flatNumber.localeCompare(b.flatNumber)
        ),
      };
    });
  }

  const preview = useMemo(() => {
    const flats = includedFlatRows
      .map((row) => ({
        flatId: row.flatId,
        previousReading: Number(row.previousReading),
        currentReading: Number(row.currentReading),
        sanctionedKw: Number(row.sanctionedKw),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.previousReading) &&
          Number.isFinite(row.currentReading) &&
          row.currentReading >= row.previousReading
      );

    if (
      flats.length === 0 ||
      !Number.isFinite(Number(buildingPrevious)) ||
      !Number.isFinite(Number(buildingCurrent))
    ) {
      return null;
    }

    return previewElectricityBills({
      buildingPreviousReading: Number(buildingPrevious),
      buildingCurrentReading: Number(buildingCurrent),
      ratePerUnit: Number(ratePerUnit),
      basicChargePerKw: Number(basicChargePerKw),
      serviceChargePercent: Number(serviceChargePercent),
      flats,
    });
  }, [
    includedFlatRows,
    buildingPrevious,
    buildingCurrent,
    ratePerUnit,
    basicChargePerKw,
    serviceChargePercent,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (includedFlatRows.length === 0) {
      setError("Select at least one flat to bill for this month.");
      return;
    }

    const formData = new FormData();
    formData.set("building_wing", activeWing);
    formData.set("billing_month", billingMonth);
    formData.set("reading_date", readingDate);
    formData.set("building_previous_reading", buildingPrevious);
    formData.set("building_current_reading", buildingCurrent);
    formData.set("building_sanctioned_kw", buildingSanctionedKw);
    formData.set("building_bill_amount", buildingBillAmount);
    formData.set("rate_per_unit", ratePerUnit);
    formData.set("basic_charge_per_kw", basicChargePerKw);
    formData.set("service_charge_percent", serviceChargePercent);

    includedFlatRows.forEach((row, index) => {
      formData.set(`flat_id_${index}`, row.flatId);
      formData.set(`previous_reading_${index}`, row.previousReading);
      formData.set(`current_reading_${index}`, row.currentReading);
      formData.set(`sanctioned_kw_${index}`, row.sanctionedKw);
    });
    formData.set("flat_count", String(includedFlatRows.length));

    startTransition(async () => {
      const result = await generateElectricityBillingAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        `${buildingWingLabel(activeWing)}: bills generated for ${result.flatCount} flat(s). Total ${formatInr(result.totalBilled)}.`
      );
      router.refresh();
    });
  }

  const wingCounts = {
    C: flatRowsByWing.C.filter((row) => row.included).length,
    D: flatRowsByWing.D.filter((row) => row.included).length,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">
        Generate monthly electricity bills
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Flats are listed for the selected billing month — including mid-month
        move-ins and vacated units that were occupied that month. Uncheck a flat
        to skip it (e.g. vacant from next month). Add a flat manually if needed.
      </p>

      <div
        className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 sm:max-w-md"
        role="tablist"
        aria-label="Building wing"
      >
        {(["C", "D"] as const).map((wing) => (
          <button
            key={wing}
            type="button"
            role="tab"
            aria-selected={activeWing === wing}
            onClick={() => setActiveWing(wing)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeWing === wing
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {buildingWingLabel(wing)}
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({wingCounts[wing]} flats)
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Billing month
          </span>
          <input
            name="billing_month"
            type="month"
            required
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          {loadingFlats ? (
            <span className="mt-1 block text-xs text-slate-500">
              Loading flats for this month…
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Reading date
          </span>
          <input
            name="reading_date"
            type="date"
            required
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            {buildingWingLabel(activeWing)} — previous main meter reading
          </span>
          <input
            type="number"
            min={0}
            step={1}
            required
            value={buildingPrevious}
            onChange={(e) =>
              updateWingMeter(activeWing, { buildingPrevious: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            {buildingWingLabel(activeWing)} — current main meter reading
          </span>
          <input
            type="number"
            min={0}
            step={1}
            required
            value={buildingCurrent}
            onChange={(e) =>
              updateWingMeter(activeWing, { buildingCurrent: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            {buildingWingLabel(activeWing)} sanctioned load (kW)
          </span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={buildingSanctionedKw}
            onChange={(e) =>
              updateWingMeter(activeWing, { buildingSanctionedKw: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Utility bill amount (₹, reference)
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={buildingBillAmount}
            onChange={(e) =>
              updateWingMeter(activeWing, { buildingBillAmount: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Rate per unit (₹)
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            required
            value={ratePerUnit}
            onChange={(e) => setRatePerUnit(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Basic charge per kW (₹)
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            required
            value={basicChargePerKw}
            onChange={(e) => setBasicChargePerKw(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Service charge (%)
          </span>
          <input
            type="number"
            min={0}
            step={0.1}
            required
            value={serviceChargePercent}
            onChange={(e) => setServiceChargePercent(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
      </div>

      {preview ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            <strong>{buildingWingLabel(activeWing)}</strong> usage{" "}
            <strong>{preview.buildingUnits}</strong> units · common area{" "}
            <strong>{preview.commonAreaUnits.toFixed(2)}</strong> units · share
            per flat <strong>{preview.commonSharePerFlat.toFixed(2)}</strong>{" "}
            units ({includedFlatRows.length} flat
            {includedFlatRows.length === 1 ? "" : "s"} included)
          </p>
        </div>
      ) : null}

      {addableFlats.length > 0 ? (
        <label className="mt-6 block max-w-md">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Add flat for this billing month
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                addFlatForMonth(value);
                e.target.value = "";
              }
            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">Select a flat…</option>
            {addableFlats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flat.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {flatRows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No flats for {billingMonth} in {buildingWingLabel(activeWing)}. Add a
          flat manually or switch wing.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Bill</th>
                <th className="px-3 py-3">Flat</th>
                <th className="px-3 py-3">Prev</th>
                <th className="px-3 py-3">Current</th>
                <th className="px-3 py-3">kW</th>
                <th className="px-3 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flatRows.map((row) => {
                const calc = row.included
                  ? preview?.flats.find((f) => f.flatId === row.flatId)
                  : undefined;
                const badge = occupancyBadge(row.occupancyKind);
                return (
                  <tr
                    key={row.flatId}
                    className={row.included ? undefined : "bg-slate-50/80 opacity-70"}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={row.included}
                        aria-label={`Include flat ${row.flatNumber}`}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            included: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.flatNumber}
                      </p>
                      <p className="text-xs text-slate-500">{row.tenantName}</p>
                      {badge ? (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                          {badge}
                        </span>
                      ) : null}
                      {row.occupancyNote ? (
                        <p className="mt-0.5 text-xs text-amber-800">
                          {row.occupancyNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        required={row.included}
                        disabled={!row.included}
                        value={row.previousReading}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            previousReading: e.target.value,
                          })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        required={row.included}
                        disabled={!row.included}
                        value={row.currentReading}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            currentReading: e.target.value,
                          })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        required={row.included}
                        disabled={!row.included}
                        value={row.sanctionedKw}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            sanctionedKw: e.target.value,
                          })
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      {calc ? (
                        <>
                          <p className="font-semibold text-slate-900">
                            {formatInr(calc.breakdown.totalDue)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatElectricityFormulaSummary(
                              calc.breakdown,
                              preview?.config
                            )}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          pending || loadingFlats || !preview || includedFlatRows.length === 0
        }
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending
          ? "Generating…"
          : `Generate bills for ${buildingWingLabel(activeWing)}`}
      </button>
    </form>
  );
}
