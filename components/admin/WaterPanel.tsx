"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWaterTankerAction } from "@/app/admin/ops-actions";
import AccountSelectField from "@/components/admin/AccountSelectField";
import type { PaymentAccountOption } from "@/lib/payment-accounts";

type VendorOption = { id: string; label: string };
type WaterRow = {
  id: string;
  deliveryDate: string;
  amountLabel: string;
  vendorName: string;
  paymentStatus: string;
  payerLabel: string | null;
  notes: string | null;
};

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function WaterPanel({
  vendors,
  rows,
  accounts,
}: {
  vendors: VendorOption[];
  rows: WaterRow[];
  accounts: PaymentAccountOption[];
}) {
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
      const result = await createWaterTankerAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Tanker order saved.");
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Record tanker</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Delivery date
            </span>
            <input
              type="date"
              name="delivery_date"
              required
              defaultValue={todayIsoDate()}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Amount (₹)
            </span>
            <input
              type="number"
              name="amount"
              min={0}
              step={1}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Vendor
            </span>
            <select
              name="vendor_id"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              defaultValue=""
            >
              <option value="">Optional</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Payment status
            </span>
            <select
              name="payment_status"
              defaultValue="pending"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <AccountSelectField
              accounts={accounts}
              name="payer_account_id"
              label="Paid by (account)"
              hint="Who paid for this tanker — Joint, Kasi, Kanthu, or Pratyu."
              allowEmpty
              emptyLabel="Not specified"
            />
          </div>
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
          {pending ? "Saving…" : "Save order"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Orders</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tanker orders yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900">
                  {row.deliveryDate} · {row.amountLabel}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {row.vendorName} · {row.paymentStatus}
                  {row.payerLabel ? ` · Paid by ${row.payerLabel}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
