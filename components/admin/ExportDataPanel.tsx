"use client";

import { useMemo, useState } from "react";
import { EXPORT_DATASETS, type ExportDataset } from "@/lib/export-data";

type FlatOption = {
  flatNumber: string;
  building: string;
};

type Props = {
  flats: FlatOption[];
};

const DATASET_LABELS: Record<ExportDataset, string> = {
  flats: "Flats inventory",
  payments: "Rent payments",
  receipts: "Receipts",
  tenancies: "Tenancies",
  expenses: "Expenses (water + maintenance)",
};

export default function ExportDataPanel({ flats }: Props) {
  const [dataset, setDataset] = useState<ExportDataset>("payments");
  const [building, setBuilding] = useState<"all" | "C" | "D">("all");
  const [flat, setFlat] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [billingMonth, setBillingMonth] = useState("");

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("dataset", dataset);
    params.set("building", building);
    if (flat.trim()) params.set("flat", flat.trim().toUpperCase());
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (billingMonth) params.set("month", billingMonth);
    return `/admin/flats/export?${params.toString()}`;
  }, [dataset, building, flat, fromDate, toDate, billingMonth]);

  const buildingFlats = useMemo(() => {
    if (building === "all") return flats;
    return flats.filter((row) => row.building === building);
  }, [building, flats]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">Export data</h3>
      <p className="mt-1 text-sm text-slate-500">
        Download CSV for all records or filter by date range, billing month,
        building wing, or flat.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Data to export
          </span>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value as ExportDataset)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {EXPORT_DATASETS.map((value) => (
              <option key={value} value={value}>
                {DATASET_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Building
          </span>
          <select
            value={building}
            onChange={(e) =>
              setBuilding(e.target.value as "all" | "C" | "D")
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="all">All buildings</option>
            <option value="C">Building C</option>
            <option value="D">Building D</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Flat (optional)
          </span>
          <input
            list="export-flat-options"
            value={flat}
            onChange={(e) => setFlat(e.target.value)}
            placeholder="e.g. C201 or D301"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <datalist id="export-flat-options">
            {buildingFlats.map((row) => (
              <option key={row.flatNumber} value={row.flatNumber} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            From date
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            To date
          </span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Billing month (payments / receipts)
          </span>
          <input
            type="month"
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Leave blank to include all months. Date range and billing month can
            be combined.
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={exportUrl}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Download CSV
        </a>
        <p className="text-xs text-slate-500">
          Opens as a file download. Sign in as admin if prompted.
        </p>
      </div>
    </section>
  );
}
