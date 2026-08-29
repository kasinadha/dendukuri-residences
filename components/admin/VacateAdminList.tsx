"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeMoveRequestAction,
  updateVacateStatusAction,
} from "@/app/admin/ops-actions";
import { todayIsoDate } from "@/lib/dates";

type VacateRow = {
  id: string;
  tenantName: string;
  flatNumber: string;
  status: string;
  requestType: "vacate" | "transfer";
  reason: string | null;
  preferredFlatNumber: string | null;
};

type VacantFlatOption = {
  id: string;
  label: string;
};

export default function VacateAdminList({
  rows,
  vacantFlats,
}: {
  rows: VacateRow[];
  vacantFlats: VacantFlatOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onStatus(id: string, status: string) {
    setError("");
    const formData = new FormData();
    formData.set("id", id);
    formData.set("status", status);
    startTransition(async () => {
      const result = await updateVacateStatusAction(formData);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  function onComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await completeMoveRequestAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="p-6 text-sm text-slate-500">No move requests.</p>;
  }

  return (
    <div>
      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {row.tenantName} · Flat {row.flatNumber}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {row.requestType === "transfer"
                    ? "Transfer within"
                    : "Move out"}
                </p>
                {row.preferredFlatNumber ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Preferred: {row.preferredFlatNumber}
                  </p>
                ) : null}
                {row.reason ? (
                  <p className="mt-1 text-sm text-slate-500">{row.reason}</p>
                ) : null}
              </div>
              {row.status === "completed" ? (
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                  Completed
                </span>
              ) : (
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={row.status}
                  disabled={pending}
                  onChange={(e) => onStatus(row.id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}
            </div>

            {row.status !== "completed" && row.status !== "rejected" ? (
              <form
                onSubmit={onComplete}
                className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <input type="hidden" name="id" value={row.id} />
                {row.requestType === "transfer" ? (
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">
                      Move to vacant flat
                    </span>
                    <select
                      name="target_flat_id"
                      required
                      defaultValue={vacantFlats[0]?.id ?? ""}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    >
                      {vacantFlats.length === 0 ? (
                        <option value="">No vacant flats</option>
                      ) : (
                        vacantFlats.map((flat) => (
                          <option key={flat.id} value={flat.id}>
                            {flat.label}
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      type="hidden"
                      name="effective_date"
                      value={todayIsoDate()}
                    />
                  </label>
                ) : (
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">
                      Move-out date
                    </span>
                    <input
                      type="date"
                      name="effective_date"
                      defaultValue={todayIsoDate()}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  disabled={
                    pending ||
                    (row.requestType === "transfer" && vacantFlats.length === 0)
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {row.requestType === "transfer"
                    ? "Complete transfer"
                    : "Complete move-out"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
