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
  displayUpiId: string | null;
  displayUpiQrUrl: string | null;
  payeeName: string;
};

const PURPOSES: PaymentPurpose[] = ["rent", "advance", "maintenance"];

function formatActionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/Failed to find Server Action|server action/i.test(message)) {
    return "This page is out of date after a recent update. Reload the page (hard refresh), then submit again.";
  }
  if (/Body exceeded|body size limit|413/i.test(message)) {
    return "Upload is too large. Remove the screenshot or use a smaller image (under 5 MB), then try again.";
  }
  return message || "Something went wrong. Reload the page and try again.";
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
      try {
        const result = await lookupPublicFlatAction(formData);
        if (!result.ok) {
          setFlat(null);
          setError(result.error);
          return;
        }
        setFlat(result.flat);
        setFlatInput(result.flat.flatNumber);
        // Never preload rent/deposit/maintenance for anonymous payers.
        setAmount("");
      } catch (err) {
        setFlat(null);
        setError(formatActionError(err));
      }
    });
  }

  function changePurpose(next: PaymentPurpose) {
    setPurpose(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!flat) {
      setError("Look up your flat number first.");
      return;
    }
    const amountRaw = amount.trim();
    const amountNum = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("flat_number", flat.flatNumber);
    formData.set("purpose", purpose);
    formData.set("amount", amountRaw);
    startTransition(async () => {
      try {
        const result = await submitPublicPayClaimAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess(
          "Submitted. The owner will review your UTR. A receipt is only created after approval."
        );
        form.reset();
        setAmount("");
        setBillingMonth(currentBillingMonthKey());
      } catch (err) {
        setError(formatActionError(err));
      }
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
          Enter your flat number to load UPI details. Amount is entered by you —
          rent and dues are not shown here.
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
              onChange={(e) => {
                const next = e.target.value;
                setFlatInput(next);
                if (
                  flat &&
                  next.trim().toUpperCase() !== flat.flatNumber.toUpperCase()
                ) {
                  setFlat(null);
                  setAmount("");
                  setSuccess("");
                }
              }}
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
            Flat {flat.flatNumber} found. Choose purpose, enter the amount you
            are paying, and continue below.
          </p>
        ) : null}
      </form>

      {flat ? (
        <div
          key={flat.flatId}
          className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">2. Pay via UPI</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the amount you owe, pay first, then submit your UTR for
              owner confirmation.
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

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Amount to pay (₹)
              </span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Enter the amount yourself. Flat rent is not shown on this page.
              </span>
            </label>

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
                ) : (
                  <p className="text-sm text-slate-500">
                    Enter an amount above to generate the UPI link and QR.
                  </p>
                )}
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
            <input type="hidden" name="amount" value={amount} />

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
              <p className="block text-sm text-slate-600 sm:col-span-2">
                Amount submitted:{" "}
                <span className="font-semibold text-slate-900">
                  {amount && Number(amount) > 0 ? `₹${amount}` : "—"}
                </span>
                {" · "}
                Enter or update the amount in step 2 before submitting.
              </p>
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
              disabled={pending || !amount}
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
