"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMoveInDatesFromCsvAction } from "@/app/admin/tenants/actions";
import type { SyncMoveInDatesSummary } from "@/lib/sync-move-in-dates";

export default function SyncMoveInDatesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SyncMoveInDatesSummary | null>(null);

  function handleSync() {
    setError("");
    setSummary(null);
    if (
      !window.confirm(
        "Update move-in dates for all active tenancies from data/rental-payment-tracking.csv? Existing dates will be overwritten when the CSV has a date for that flat."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await syncMoveInDatesFromCsvAction();
      if (!result.ok) {
        setError("Sync failed.");
        return;
      }
      setSummary(result.summary);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Bulk move-in dates</h3>
      <p className="mt-1 text-xs text-slate-600">
        Reads <code className="text-slate-800">data/rental-payment-tracking.csv</code>{" "}
        and sets each active tenancy&apos;s move-in date from the first row per flat.
        Move-in month has no rent or electricity dues; dues start the month after.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={handleSync}
        className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync move-in dates from CSV"}
      </button>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p>
            CSV flats with dates: {summary.flatsInCsv} · Updated {summary.updated} ·
            Unchanged {summary.unchanged}
          </p>
          {summary.skippedNoTenancy.length > 0 ? (
            <p>No active tenancy: {summary.skippedNoTenancy.join(", ")}</p>
          ) : null}
          {summary.skippedNoDate.length > 0 ? (
            <p>Active but no CSV date: {summary.skippedNoDate.join(", ")}</p>
          ) : null}
          {summary.errors.length > 0 ? (
            <p className="text-red-700">{summary.errors.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
