"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importRentalCsvAction } from "@/app/admin/flats/actions";
import type { ImportSummary } from "@/lib/import-rental-csv";

type Props = {
  propertyReady: boolean;
};

export default function ImportRentalCsvPanel({ propertyReady }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function handleImport() {
    setError("");
    setSummary(null);
    startTransition(async () => {
      const result = await importRentalCsvAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.summary);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">
        Import from rental-tracking.csv
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Idempotent: skips existing flat numbers, matching tenants, and active
        tenancies. Advances are stored as security deposits — not rent
        payments. You can review and edit rows afterward.
      </p>

      {!propertyReady ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run the Phase 9 SQL migration first so <code>properties</code> and
          deposit columns exist. File:{" "}
          <code>supabase/migrations/20260815_phase9_property_and_flat_fields.sql</code>
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || !propertyReady}
        onClick={handleImport}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Importing…" : "Run CSV import"}
      </button>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            Flats created {summary.flatsCreated} / skipped {summary.flatsSkipped}
          </p>
          <p>
            Tenants created {summary.tenantsCreated} / skipped{" "}
            {summary.tenantsSkipped}
          </p>
          <p>
            Tenancies created {summary.tenanciesCreated} / skipped{" "}
            {summary.tenanciesSkipped}
          </p>
          {summary.reviewFlags.length > 0 ? (
            <div>
              <p className="font-semibold text-amber-800">Review flags</p>
              <ul className="mt-1 list-disc pl-5 text-amber-900">
                {summary.reviewFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.errors.length > 0 ? (
            <div>
              <p className="font-semibold text-red-700">Errors</p>
              <ul className="mt-1 list-disc pl-5 text-red-700">
                {summary.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
