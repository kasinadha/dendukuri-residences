"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantSubmitRentPayment } from "@/app/tenant/actions";
import {
  buildUpiPayLink,
  buildUpiQrImageUrl,
} from "@/lib/rent-upi";

type Props = {
  tenancyId: string;
  flatNumber: string;
  monthlyRent: number | null;
  defaultBillingMonth: string;
  upiId: string | null;
  upiQrUrl?: string | null;
  payeeName: string;
};

export default function TenantRentPaymentForm({
  tenancyId,
  flatNumber,
  monthlyRent,
  defaultBillingMonth,
  upiId,
  upiQrUrl,
  payeeName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [amount, setAmount] = useState(
    monthlyRent != null ? String(monthlyRent) : ""
  );
  const [billingMonth, setBillingMonth] = useState(defaultBillingMonth);

  const amountNum = Number(amount);
  const upiLink = useMemo(() => {
    if (!upiId || !Number.isFinite(amountNum) || amountNum <= 0) return null;
    return buildUpiPayLink({
      upiId,
      payeeName,
      amount: amountNum,
      note: `Rent ${flatNumber} ${billingMonth}`,
    });
  }, [upiId, payeeName, amountNum, flatNumber, billingMonth]);

  const generatedQrUrl = upiLink ? buildUpiQrImageUrl(upiLink) : null;
  const qrUrl = upiQrUrl?.trim() || generatedQrUrl;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    formData.set("tenancy_id", tenancyId);
    startTransition(async () => {
      const result = await tenantSubmitRentPayment(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        "Submitted. The owner will confirm the UTR and your receipt will appear under Receipts."
      );
      event.currentTarget.reset();
      setAmount(monthlyRent != null ? String(monthlyRent) : "");
      setBillingMonth(defaultBillingMonth);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Pay via UPI</h3>
        <p className="mt-1 text-sm text-slate-500">
          Pay the rent amount, then submit your UTR below for confirmation.
        </p>

        {!upiId ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            UPI ID is not configured for this flat yet. Ask the owner to set it
            on the flat, or set <code>NEXT_PUBLIC_RENT_UPI_ID</code>.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                UPI ID
              </p>
              <p className="mt-1 break-all text-lg font-bold text-slate-900">
                {upiId}
              </p>
              <p className="mt-1 text-sm text-slate-500">{payeeName}</p>
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="UPI QR code for rent payment"
                width={220}
                height={220}
                className="rounded-xl border border-slate-200 bg-white p-2"
              />
            ) : null}
            {upiLink ? (
              <a
                href={upiLink}
                className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Open UPI app
              </a>
            ) : null}
            <p className="text-xs text-slate-500">
              Tip: include flat {flatNumber} in the UPI remark if asked.
            </p>
          </div>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">
          Submit UTR for confirmation
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Flat {flatNumber}. Receipt is generated after owner approval.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
              Amount paid (₹)
            </span>
            <input
              type="number"
              name="amount"
              required
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
              defaultValue={new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
              }).format(new Date())}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              UTR / UPI reference
            </span>
            <input
              name="utr"
              required
              placeholder="Transaction ID from UPI app"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Payment screenshot (optional)
            </span>
            <input
              name="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
            />
            <span className="mt-1 block text-xs text-slate-500">
              JPEG, PNG, WebP, or HEIC · max 5 MB
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Notes (optional)
            </span>
            <textarea
              name="notes"
              rows={3}
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
          {pending ? "Submitting…" : "Submit for confirmation"}
        </button>
      </form>
    </div>
  );
}
