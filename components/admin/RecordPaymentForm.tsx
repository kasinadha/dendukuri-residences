"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchTenancyDuesBreakdownAction,
  recordRentPayment,
} from "@/app/admin/payments/actions";
import AccountSelectField from "@/components/admin/AccountSelectField";
import DuesBreakdownTable from "@/components/pay/DuesBreakdownTable";
import { computePaymentStatus } from "@/lib/payment-status";
import {
  applyAdditionalPaymentToBreakdown,
  breakdownPaymentAmountDefaults,
  toOutstandingOnlyBreakdown,
  type DuesBreakdown,
} from "@/lib/dues-breakdown";
import type { PaymentAccountOption } from "@/lib/payment-accounts";
import { formatInr } from "@/lib/receipts";

export type TenancyOption = {
  id: string;
  flatId: string;
  label: string;
  flatNumber: string;
  tenantName: string;
  monthlyRent: number | null;
  depositAmount: number | null;
  depositPaid: number | null;
  suggestedReceiverAccountId?: string | null;
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

function paymentAmountDefaults(breakdown: DuesBreakdown) {
  return breakdownPaymentAmountDefaults(breakdown);
}

type Props = {
  tenancies: TenancyOption[];
  accounts: PaymentAccountOption[];
  defaultTenancyId?: string;
  defaultBillingMonth?: string;
};

export default function RecordPaymentForm({
  tenancies,
  accounts,
  defaultTenancyId,
  defaultBillingMonth,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const initialTenancy =
    tenancies.find((t) => t.id === defaultTenancyId) ?? tenancies[0];
  const [tenancyId, setTenancyId] = useState(initialTenancy?.id ?? "");
  const [receiverAccountId, setReceiverAccountId] = useState(
    initialTenancy?.suggestedReceiverAccountId ?? ""
  );
  const selected = tenancies.find((t) => t.id === tenancyId) ?? tenancies[0];
  const [amountDue, setAmountDue] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [billingMonth, setBillingMonth] = useState(
    defaultBillingMonth ?? currentYearMonth()
  );
  const [paymentCategory, setPaymentCategory] = useState<"dues" | "deposit">(
    "dues"
  );
  const [breakdown, setBreakdown] = useState<DuesBreakdown | null>(null);
  const [breakdownError, setBreakdownError] = useState("");

  const dueNum = Number(amountDue);
  const paidNum = Number(amountPaid);
  const previewStatus =
    Number.isFinite(dueNum) && Number.isFinite(paidNum)
      ? computePaymentStatus(dueNum, paidNum)
      : null;
  const previewBreakdown = useMemo(() => {
    if (!breakdown) return null;
    if (!Number.isFinite(paidNum) || paidNum <= 0) {
      return toOutstandingOnlyBreakdown(breakdown);
    }
    return toOutstandingOnlyBreakdown(
      applyAdditionalPaymentToBreakdown(breakdown, paidNum)
    );
  }, [breakdown, paidNum]);
  const electricityOnlyHint = useMemo(() => {
    if (!breakdown) return null;
    const view = toOutstandingOnlyBreakdown(breakdown);
    const nonElectricOutstanding = view.lines
      .filter((line) => line.key !== "electricity")
      .reduce((sum, line) => sum + line.outstanding, 0);
    const electricity = view.lines.find((line) => line.key === "electricity");
    if (
      nonElectricOutstanding <= 0 &&
      electricity &&
      electricity.outstanding > 0
    ) {
      return `Only electricity is outstanding for this month (${formatInr(electricity.outstanding)}). Record that amount to generate a receipt for the electricity portion.`;
    }
    return null;
  }, [breakdown]);

  useEffect(() => {
    if (
      paymentCategory !== "dues" ||
      !tenancyId ||
      !selected?.flatId ||
      !billingMonth
    ) {
      if (paymentCategory === "deposit") {
        setBreakdown(null);
        setBreakdownError("");
        const outstanding =
          selected?.depositAmount != null && selected.depositPaid != null
            ? Math.max(0, selected.depositAmount - selected.depositPaid)
            : null;
        const value =
          outstanding != null && outstanding > 0 ? String(outstanding) : "";
        setAmountDue(value);
        setAmountPaid(value);
      }
      return;
    }
    const formData = new FormData();
    formData.set("tenancy_id", tenancyId);
    formData.set("flat_id", selected.flatId);
    formData.set("billing_month", billingMonth);
    let cancelled = false;
    void fetchTenancyDuesBreakdownAction(formData).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setBreakdown(null);
        setBreakdownError(result.error);
        return;
      }
      setBreakdownError("");
      setBreakdown(result.breakdown);
      const defaults = paymentAmountDefaults(result.breakdown);
      setAmountDue(defaults.amountDue);
      setAmountPaid(defaults.amountPaid);
    });
    return () => {
      cancelled = true;
    };
  }, [tenancyId, selected?.flatId, selected?.depositAmount, selected?.depositPaid, billingMonth, paymentCategory]);

  function onTenancyChange(id: string) {
    setTenancyId(id);
    const next = tenancies.find((t) => t.id === id);
    setReceiverAccountId(next?.suggestedReceiverAccountId ?? "");
    setAmountDue("");
    setAmountPaid("");
    setBreakdown(null);
    setBreakdownError("");
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
        No tenancies available for payment recording this month.
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
        Active tenancies and vacated tenants with outstanding final-month dues.
        Issues a unique receipt automatically.
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
                {t.label}
                {t.monthlyRent != null ? ` · rent ₹${t.monthlyRent}` : ""}
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

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Payment for
          </span>
          <select
            name="payment_category"
            value={paymentCategory}
            onChange={(e) =>
              setPaymentCategory(
                e.target.value === "deposit" ? "deposit" : "dues"
              )
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="dues">Monthly dues (rent, charges, electricity)</option>
            <option value="deposit">Deposit / advance</option>
          </select>
        </label>

        {paymentCategory === "deposit" ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 sm:col-span-2">
            Deposit is tracked separately from monthly rent. Agreed{" "}
            {selected?.depositAmount != null
              ? formatInr(selected.depositAmount)
              : "—"}
            , paid{" "}
            {selected?.depositPaid != null
              ? formatInr(selected.depositPaid)
              : "—"}
            .
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Billing month
          </span>
          <input
            type="month"
            name="billing_month"
            required
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
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
            type="text"
            inputMode="decimal"
            name="amount_due"
            required
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
            type="text"
            inputMode="decimal"
            name="amount_paid"
            required
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

        <AccountSelectField
          key={tenancyId}
          accounts={accounts}
          name="receiver_account_id"
          label="Received into account"
          hint="Auto-filled from flat QR/UPI when available. Override if needed."
          defaultValue={receiverAccountId}
          allowEmpty
          emptyLabel="Unassigned"
        />

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

      {electricityOnlyHint ? (
        <p className="mt-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          {electricityOnlyHint}
        </p>
      ) : null}

      {breakdown?.infoMessage ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {breakdown.infoMessage}
        </p>
      ) : null}

      {previewBreakdown && paymentCategory === "dues" ? (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-slate-900">Dues breakdown</h4>
          <div className="mt-3">
            <DuesBreakdownTable breakdown={previewBreakdown} />
          </div>
        </div>
      ) : breakdownError ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {breakdownError}
        </p>
      ) : null}

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
