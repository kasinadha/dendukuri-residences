"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTenancy, seedD201Action } from "@/app/admin/flats/actions";

export type VacantFlatOption = {
  id: string;
  label: string;
};

type Props = {
  vacantFlats: VacantFlatOption[];
  d201Present: boolean;
};

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AssignTenancyForm({
  vacantFlats,
  d201Present,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"existing_flat" | "new_flat">(
    vacantFlats.length > 0 ? "existing_flat" : "new_flat"
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    formData.set("mode", mode);

    startTransition(async () => {
      const result = await assignTenancy(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Tenancy created — flat marked occupied.");
      router.refresh();
    });
  }

  function handleSeedD201() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await seedD201Action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const label =
        result.status === "created"
          ? "D201 seeded (occupied, ₹10,000 rent, ₹50,000 deposit, source Poster)."
          : result.status === "updated"
            ? "D201 updated to Phase 3 values."
            : "D201 already present.";
      setSuccess(label);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Assign tenancy</h3>
        <p className="mt-1 text-sm text-slate-500">
          Link a tenant to a flat. Active tenancies set occupancy to occupied.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("existing_flat")}
            className={`rounded-xl px-3 py-2 font-semibold ${
              mode === "existing_flat"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Existing vacant flat
          </button>
          <button
            type="button"
            onClick={() => setMode("new_flat")}
            className={`rounded-xl px-3 py-2 font-semibold ${
              mode === "new_flat"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            New flat
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {mode === "existing_flat" ? (
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Vacant flat
              </span>
              <select
                name="flat_id"
                required={mode === "existing_flat"}
                disabled={vacantFlats.length === 0}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                defaultValue={vacantFlats[0]?.id ?? ""}
              >
                {vacantFlats.length === 0 ? (
                  <option value="">No vacant flats — use New flat</option>
                ) : (
                  vacantFlats.map((flat) => (
                    <option key={flat.id} value={flat.id}>
                      {flat.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Flat number
                </span>
                <input
                  name="flat_number"
                  required
                  placeholder="e.g. D201"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Type (optional)
                </span>
                <input
                  name="flat_type"
                  placeholder="1BHK / 2BHK"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
            </>
          )}

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Tenant full name
            </span>
            <input
              name="tenant_full_name"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Phone (optional)
            </span>
            <input
              name="tenant_phone"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Email (optional)
            </span>
            <input
              type="email"
              name="tenant_email"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Monthly rent (₹)
            </span>
            <input
              type="number"
              name="monthly_rent"
              required
              min={1}
              step={1}
              defaultValue={10000}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Security deposit (₹)
            </span>
            <input
              type="number"
              name="security_deposit"
              required
              min={0}
              step={1}
              defaultValue={50000}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Lead source
            </span>
            <input
              name="source"
              defaultValue="Poster"
              placeholder="Poster"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Start date
            </span>
            <input
              type="date"
              name="start_date"
              required
              defaultValue={todayIsoDate()}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
        </div>

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
          disabled={pending || (mode === "existing_flat" && vacantFlats.length === 0)}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Saving…" : "Create tenancy"}
        </button>
      </form>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6">
        <h3 className="text-base font-bold text-slate-900">Seed D201</h3>
        <p className="mt-1 text-sm text-slate-500">
          First real record: rent ₹10,000 · deposit ₹50,000 · source Poster.
          {d201Present ? " Already visible in the list below." : ""}
        </p>
        <button
          type="button"
          onClick={handleSeedD201}
          disabled={pending}
          className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : d201Present
              ? "Refresh / align D201"
              : "Create D201 tenancy"}
        </button>
      </div>
    </div>
  );
}
