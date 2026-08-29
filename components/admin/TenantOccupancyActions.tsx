"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markTenantVacatedAction,
  transferTenantAction,
} from "@/app/admin/tenants/actions";
import { todayIsoDate } from "@/lib/dates";

type VacantFlatOption = {
  id: string;
  label: string;
};

type Props = {
  tenancyId: string;
  vacantFlats: VacantFlatOption[];
  currentRent: number | null;
};

export default function TenantOccupancyActions({
  tenancyId,
  vacantFlats,
  currentRent,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState<"vacate" | "transfer" | null>(null);

  function run(
    action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>,
    formData: FormData,
    okMessage: string
  ) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(okMessage);
      setOpen(null);
      router.refresh();
    });
  }

  function onVacate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (
      !window.confirm(
        "Mark this tenant as vacated? The current flat will become vacant."
      )
    ) {
      return;
    }
    run(markTenantVacatedAction, formData, "Tenant marked vacated.");
  }

  function onTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(transferTenantAction, formData, "Tenant transferred to the new flat.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "transfer" ? null : "transfer")}
          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
        >
          Transfer
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "vacate" ? null : "vacate")}
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
        >
          Mark vacated
        </button>
      </div>

      {open === "vacate" ? (
        <form onSubmit={onVacate} className="rounded-xl bg-slate-50 p-3">
          <input type="hidden" name="tenancy_id" value={tenancyId} />
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700">
              Move-out date
            </span>
            <input
              type="date"
              name="end_date"
              defaultValue={todayIsoDate()}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Confirm vacated"}
          </button>
        </form>
      ) : null}

      {open === "transfer" ? (
        <form onSubmit={onTransfer} className="space-y-2 rounded-xl bg-slate-50 p-3">
          <input type="hidden" name="tenancy_id" value={tenancyId} />
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700">
              Vacant flat
            </span>
            <select
              name="target_flat_id"
              required
              disabled={vacantFlats.length === 0}
              defaultValue={vacantFlats[0]?.id ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700">
              New rent (optional)
            </span>
            <input
              type="number"
              name="monthly_rent"
              min={1}
              step={1}
              placeholder={
                currentRent != null ? String(currentRent) : "Keep current rent"
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700">
              Transfer date
            </span>
            <input
              type="date"
              name="start_date"
              defaultValue={todayIsoDate()}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending || vacantFlats.length === 0}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Confirm transfer"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
    </div>
  );
}
