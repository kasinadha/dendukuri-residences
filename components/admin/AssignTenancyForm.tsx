"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTenancy } from "@/app/admin/flats/actions";

export type VacantFlatOption = {
  id: string;
  label: string;
};

type Props = {
  vacantFlats: VacantFlatOption[];
};

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AssignTenancyForm({ vacantFlats }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    formData.set("mode", "existing_flat");

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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Assign tenancy</h3>
      <p className="mt-1 text-sm text-slate-500">
        Link a tenant to a vacant flat from the fixed Building C / D inventory.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Vacant flat
          </span>
          <select
            name="flat_id"
            required
            disabled={vacantFlats.length === 0}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            defaultValue={vacantFlats[0]?.id ?? ""}
          >
            {vacantFlats.length === 0 ? (
              <option value="">No vacant flats right now</option>
            ) : (
              vacantFlats.map((flat) => (
                <option key={flat.id} value={flat.id}>
                  {flat.label}
                </option>
              ))
            )}
          </select>
        </label>

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
        disabled={pending || vacantFlats.length === 0}
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : "Create tenancy"}
      </button>
    </form>
  );
}
