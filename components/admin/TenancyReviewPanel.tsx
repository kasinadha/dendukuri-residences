"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTenancyReviewAction } from "@/app/admin/flats/actions";
import type { TenancyReviewItem } from "@/lib/tenancy-review";
import { formatInr } from "@/lib/receipts";

type Props = {
  items: TenancyReviewItem[];
};

export default function TenancyReviewPanel({ items }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const editing = items.find((i) => i.id === editingId) ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateTenancyReviewAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Tenancy updated.");
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">
          Review tenancies & deposits
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Edit rent, deposit agreed/paid/dates, and notes anytime. Part-payment
          schedules stay in notes.
        </p>
      </div>

      {editing ? (
        <form
          onSubmit={handleSubmit}
          className="border-b border-slate-100 bg-slate-50 px-5 py-5 sm:px-6"
        >
          <input type="hidden" name="id" value={editing.id} />
          <p className="font-semibold text-slate-900">
            Flat {editing.flatNumber} · {editing.tenantName}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Monthly rent
              </span>
              <input
                name="monthly_rent"
                type="number"
                min="0"
                step="1"
                defaultValue={editing.monthlyRent ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Start date
              </span>
              <input
                name="start_date"
                type="date"
                defaultValue={editing.startDate ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Deposit agreed
              </span>
              <input
                name="deposit_amount"
                type="number"
                min="0"
                step="1"
                defaultValue={editing.depositAmount ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">
                Deposit paid
              </span>
              <input
                name="deposit_paid"
                type="number"
                min="0"
                step="1"
                defaultValue={editing.depositPaid ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Deposit paid date (final installment)
              </span>
              <input
                name="deposit_paid_date"
                type="date"
                defaultValue={editing.depositPaidDate ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Notes
              </span>
              <textarea
                name="notes"
                rows={4}
                defaultValue={editing.notes ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-700">{error}</p>
          ) : null}
          {success ? (
            <p className="mt-3 text-sm text-emerald-700">{success}</p>
          ) : null}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save tenancy"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No tenancies yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  Flat {item.flatNumber} · {item.tenantName}
                  {item.needsReview ? (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      review
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Rent{" "}
                  {item.monthlyRent != null ? formatInr(item.monthlyRent) : "—"}{" "}
                  · Deposit{" "}
                  {item.depositAmount != null
                    ? formatInr(item.depositAmount)
                    : "—"}{" "}
                  · Paid{" "}
                  {item.depositPaid != null
                    ? formatInr(item.depositPaid)
                    : "—"}
                  {item.depositPaidDate
                    ? ` · on ${item.depositPaidDate}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setError("");
                  setSuccess("");
                }}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-600"
              >
                Review / edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
