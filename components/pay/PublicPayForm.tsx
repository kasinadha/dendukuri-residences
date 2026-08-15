"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  lookupPublicFlatAction,
  submitPublicPayClaimAction,
} from "@/app/pay/actions";
import {
  buildUpiPayLink,
  buildUpiQrImageUrl,
  currentBillingMonthKey,
} from "@/lib/rent-upi";
import { purposeLabel, type PaymentPurpose } from "@/lib/public-pay";

type LookedUpFlat = {
  flatId: string;
  flatNumber: string;
  status: string | null;
  monthlyRent: number | null;
  maintenanceAmount: number | null;
  deposit: number | null;
  displayUpiId: string | null;
  displayUpiQrUrl: string | null;
  payeeName: string;
};

const PURPOSES: PaymentPurpose[] = ["rent", "advance", "maintenance"];

function suggestedAmount(
  purpose: PaymentPurpose,
  flat: LookedUpFlat | null
): string {
  if (!flat) return "";
  if (purpose === "rent" && flat.monthlyRent != null) {
    return String(flat.monthlyRent);
  }
  if (purpose === "maintenance" && flat.maintenanceAmount != null) {
    return String(flat.maintenanceAmount);
  }
  if (purpose === "advance" && flat.deposit != null) {
    return String(flat.deposit);
  }
  return "";
}

export default function PublicPayForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [flatInput, setFlatInput] = useState("");
  const [flat, setFlat] = useState<LookedUpFlat | null>(null);
  const [purpose, setPurpose] = useState<PaymentPurpose>("rent");
  const [amount, setAmount] = useState("");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonthKey());

  const amountNum = Number(amount);
  const upiLink = useMemo(() => {
    if (!flat?.displayUpiId || !Number.isFinite(amountNum) || amountNum <= 0) {
      return null;
    }
    return buildUpiPayLink({
      upiId: flat.displayUpiId,
      payeeName: flat.payeeName,
      amount: amountNum,
      note: `${purposeLabel(purpose)} ${flat.flatNumber}${
        purpose === "rent" ? ` ${billingMonth}` : ""
      }`,
    });
  }, [flat, amountNum, purpose, billingMonth]);

  const generatedQrUrl = upiLink ? buildUpiQrImageUrl(upiLink) : null;
  const qrUrl = flat?.displayUpiQrUrl?.trim() || generatedQrUrl;

  function lookupFlat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await lookupPublicFlatAction(formData);
      if (!result.ok) {
        setFlat(null);
        setError(result.error);
        return;
      }
      setFlat(result.flat);
      setFlatInput(result.flat.flatNumber);
      setAmount(suggestedAmount(purpose, result.flat));
    });
  }

  function changePurpose(next: PaymentPurpose) {
    setPurpose(next);
    setAmount(suggestedAmount(next, flat));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!flat) {
      setError("Look up your flat number first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("flat_number", flat.flatNumber);
    formData.set("purpose", purpose);
    startTransition(async () => {
      const result = await submitPublicPayClaimAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        "Submitted. The owner will review your UTR. A receipt is only created after approval."
      );
      event.currentTarget.reset();
      setAmount(suggestedAmount(purpose, flat));
      setBillingMonth(currentBillingMonthKey());
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={lookupFlat}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-bold text-slate-900">1. Flat details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your flat number to load the correct UPI details.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Flat number
            </span>
            <input
              name="flat_number"
              required
              placeholder="e.g. C201"
              value={flatInput}
              onChange={(e) => setFlatInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending && !flat ? "Looking up…" : "Continue"}
          </button>
        </div>
        {flat ? (
          <p className="mt-3 text-sm text-emerald-800">
            Flat {flat.flatNumber}
            {flat.status ? ` · ${flat.status}` : ""} found. Choose purpose and
            pay below.
          </p>
        ) : null}
      </form>

      {flat ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">2. Pay via UPI</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pay first, then submit your UTR for owner confirmation.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => changePurpose(p)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    purpose === p
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 text-slate-700"
                  }`}
                >
                  {purposeLabel(p)}
                </button>
              ))}
            </div>

            {!flat.displayUpiId ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                UPI ID is not configured for this flat yet. Contact the owner.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    UPI ID
                  </p>
                  <p className="mt-1 break-all text-lg font-bold text-slate-900">
                    {flat.displayUpiId}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{flat.payeeName}</p>
                </div>
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrUrl}
                    alt="UPI QR code"
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
                  Tip: include flat {flat.flatNumber} in the UPI remark if asked.
                </p>
              </div>
            )}
          </section>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-bold text-slate-900">
              3. Submit UTR for confirmation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {purposeLabel(purpose)} · Flat {flat.flatNumber}. No receipt until
              the owner approves.
            </p>

            <input type="hidden" name="purpose" value={purpose} />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Your name
                </span>
                <input
                  name="payer_name"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mobile number
                </span>
                <input
                  name="payer_phone"
                  required
                  inputMode="tel"
                  placeholder="10-digit mobile"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              {purpose === "rent" ? (
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
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Period / month (optional)
                  </span>
                  <input
                    type="month"
                    name="billing_month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </label>
              )}
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
                  placeholder={
                    purpose === "advance"
                      ? "e.g. booking advance for move-in"
                      : purpose === "maintenance"
                        ? "e.g. monthly maintenance"
                        : ""
                  }
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
      ) : error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
