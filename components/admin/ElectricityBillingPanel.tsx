"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateElectricityBillingAction } from "@/app/admin/electricity/actions";
import { buildingWingLabel, type BuildingWing } from "@/lib/building-wing";
import {
  DEFAULT_ELECTRICITY_BILLING_CONFIG,
  formatElectricityFormulaSummary,
} from "@/lib/electricity-billing";
import {
  previewElectricityBills,
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

function flatsForWing(
  occupiedFlats: OccupiedFlatForBilling[],
  wing: BuildingWing
): FlatReadingState[] {
  return occupiedFlats
    .filter((flat) => flat.buildingWing === wing)
    .map((flat) => ({
      flatId: flat.flatId,
      flatNumber: flat.flatNumber,
      tenantName: flat.tenantName,
      previousReading: String(flat.previousReading),
      currentReading: "",
      sanctionedKw: String(flat.sanctionedKw),
    }));
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeWing, setActiveWing] = useState<BuildingWing>("C");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [readingDate, setReadingDate] = useState(todayIsoDate());
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
    C: flatsForWing(occupiedFlats, "C"),
    D: flatsForWing(occupiedFlats, "D"),
  }));

  const flatRows = flatRowsByWing[activeWing];
  const wingMeter = wingMeters[activeWing];
  const { buildingPrevious, buildingCurrent, buildingSanctionedKw, buildingBillAmount } =
    wingMeter;

  useEffect(() => {
    setFlatRowsByWing({
      C: flatsForWing(occupiedFlats, "C"),
      D: flatsForWing(occupiedFlats, "D"),
    });
  }, [occupiedFlats]);

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

  const preview = useMemo(() => {
    const flats = flatRows
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
    flatRows,
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

    const formData = new FormData(event.currentTarget);
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

  if (occupiedFlats.length === 0) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        No occupied flats found. Assign active tenancies before generating
        electricity bills.
      </p>
    );
  }

  const wingCounts = {
    C: flatRowsByWing.C.length,
    D: flatRowsByWing.D.length,
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
        Choose a building wing, enter its main meter readings, then flat meters
        for occupied flats in that wing only. Common share uses that
        building&apos;s usage.
      </p>

      <input type="hidden" name="building_wing" value={activeWing} />

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
            name="building_previous_reading"
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
            name="building_current_reading"
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
            name="building_sanctioned_kw"
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
            name="building_bill_amount"
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
            name="rate_per_unit"
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
            name="basic_charge_per_kw"
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
            name="service_charge_percent"
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
            units ({flatRows.length} occupied flats in this wing)
          </p>
        </div>
      ) : null}

      {flatRows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No occupied flats in {buildingWingLabel(activeWing)}. Switch wing or
          assign tenants to flats in this building.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Flat</th>
                <th className="px-3 py-3">Prev</th>
                <th className="px-3 py-3">Current</th>
                <th className="px-3 py-3">kW</th>
                <th className="px-3 py-3">Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flatRows.map((row, index) => {
                const calc = preview?.flats.find((f) => f.flatId === row.flatId);
                return (
                  <tr key={row.flatId}>
                    <td className="px-3 py-3">
                      <input
                        type="hidden"
                        name={`flat_id_${index}`}
                        value={row.flatId}
                      />
                      <p className="font-semibold text-slate-900">
                        {row.flatNumber}
                      </p>
                      <p className="text-xs text-slate-500">{row.tenantName}</p>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`previous_reading_${index}`}
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={row.previousReading}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            previousReading: e.target.value,
                          })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`current_reading_${index}`}
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={row.currentReading}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            currentReading: e.target.value,
                          })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`sanctioned_kw_${index}`}
                        type="number"
                        min={0}
                        step={0.1}
                        required
                        value={row.sanctionedKw}
                        onChange={(e) =>
                          updateFlatRow(row.flatId, {
                            sanctionedKw: e.target.value,
                          })
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5"
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
          <input
            type="hidden"
            name="flat_count"
            value={String(flatRows.length)}
          />
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
        disabled={pending || !preview || flatRows.length === 0}
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending
          ? "Generating…"
          : `Generate bills for ${buildingWingLabel(activeWing)}`}
      </button>
    </form>
  );
}
