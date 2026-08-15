"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { recordRentPayment } from "@/app/admin/payments/actions";
import { computePaymentStatus } from "@/lib/payment-status";

export type TenancyOption = {
  id: string;
  label: string;
  flatNumber: string;
  tenantName: string;
  monthlyRent: number | null;
};

const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

function currentYearMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Props = {
  tenancies: TenancyOption[];
};

export default function RecordPaymentForm({ tenancies }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tenancyId, setTenancyId] = useState(tenancies[0]?.id ?? "");
  const selected = tenancies.find((t) => t.id === tenancyId) ?? tenancies[0];
  const [amountDue, setAmountDue] = useState(
    selected?.monthlyRent != null ? String(selected.monthlyRent) : ""
  );
  const [amountPaid, setAmountPaid] = useState(
    selected?.monthlyRent != null ? String(selected.monthlyRent) : ""
  );

  const dueNum = Number(amountDue);
  const paidNum = Number(amountPaid);
  const previewStatus =
    Number.isFinite(dueNum) && Number.isFinite(paidNum)
      ? computePaymentStatus(dueNum, paidNum)
      : null;

  function onTenancyChange(id: string) {
    setTenancyId(id);
    const next = tenancies.find((t) => t.id === id);
    if (next?.monthlyRent != null) {
      setAmountDue(String(next.monthlyRent));
      setAmountPaid(String(next.monthlyRent));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await recordRentPayment(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(`Receipt ${result.receiptNumber} created.`);
      if (result.receiptId) {
        router.push(`/admin/receipts/${result.receiptId}`);
      }
      router.refresh();
    });
  }

  if (tenancies.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        No active tenancies found. Confirmed/reserved units (before move-in)
        are excluded from rent recording.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      id="record-payment"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Record Payment</h3>
      <p className="mt-1 text-sm text-slate-500">
        Against an active tenancy. Issues a unique receipt automatically.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Flat / Tenant
          </span>
          <select
            name="tenancy_id"
            required
            value={tenancyId}
            onChange={(e) => onTenancyChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                Flat {t.flatNumber} — {t.tenantName}
                {t.monthlyRent != null ? ` (₹${t.monthlyRent})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm sm:col-span-2">
          <p>
            <span className="text-slate-500">Flat:</span>{" "}
            <span className="font-semibold text-slate-900">
              {selected?.flatNumber ?? "—"}
            </span>
          </p>
          <p className="mt-1">
            <span className="text-slate-500">Tenant:</span>{" "}
            <span className="font-semibold text-slate-900">
              {selected?.tenantName ?? "—"}
            </span>
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Billing month
          </span>
          <input
            type="month"
            name="billing_month"
            required
            defaultValue={currentYearMonth()}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Payment date
          </span>
          <input
            type="date"
            name="payment_date"
            required
            defaultValue={todayIsoDate()}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Amount due (₹)
          </span>
          <input
            type="number"
            name="amount_due"
            required
            min={0}
            step={1}
            value={amountDue}
            onChange={(e) => setAmountDue(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Amount paid (₹)
          </span>
          <input
            type="number"
            name="amount_paid"
            required
            min={0}
            step={1}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Payment method
          </span>
          <select
            name="payment_mode"
            required
            defaultValue="upi"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status (auto)
          </p>
          <p className="mt-1 font-semibold capitalize text-slate-900">
            {previewStatus ?? "—"}
          </p>
        </div>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Transaction / reference number
          </span>
          <input
            type="text"
            name="transaction_reference"
            placeholder="UPI / NEFT / cheque reference"
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
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : "Record Payment"}
      </button>
    </form>
  );
}
