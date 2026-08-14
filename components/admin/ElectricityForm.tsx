"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordElectricityReading } from "@/app/admin/electricity/actions";

type FlatOption = { id: string; label: string };

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ElectricityForm({ flats }: { flats: FlatOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await recordElectricityReading(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Reading saved.");
      event.currentTarget.reset();
      router.refresh();
    });
  }

  if (flats.length === 0) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Add flats first before logging meter readings.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Log meter reading</h3>
      <p className="mt-1 text-sm text-slate-500">
        Units are calculated as current − previous. Optional bill amount in ₹.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Flat
          </span>
          <select
            name="flat_id"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            defaultValue={flats[0]?.id}
          >
            {flats.map((flat) => (
              <option key={flat.id} value={flat.id}>
                {flat.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Reading date
          </span>
          <input
            type="date"
            name="reading_date"
            required
            defaultValue={todayIsoDate()}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Status
          </span>
          <select
            name="status"
            defaultValue="recorded"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="recorded">Recorded</option>
            <option value="billed">Billed</option>
            <option value="paid">Paid</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Previous reading
          </span>
          <input
            type="number"
            name="previous_reading"
            required
            min={0}
            step={1}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Current reading
          </span>
          <input
            type="number"
            name="current_reading"
            required
            min={0}
            step={1}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Bill amount (₹, optional)
          </span>
          <input
            type="number"
            name="bill_amount"
            min={0}
            step={1}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Notes
          </span>
          <textarea
            name="notes"
            rows={2}
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
        disabled={pending}
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save reading"}
      </button>
    </form>
  );
}
