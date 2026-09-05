"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentAccountAction, ensurePaymentAccountsAction } from "@/app/admin/accounts/actions";
import type { PaymentAccount } from "@/lib/payment-accounts";

export default function PaymentAccountsPanel({
  accounts,
  loadError,
  tableMissing,
}: {
  accounts: PaymentAccount[];
  loadError?: string | null;
  tableMissing?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>, accountId: string) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setPendingId(accountId);
    const formData = new FormData(event.currentTarget);
    formData.set("id", accountId);

    startTransition(async () => {
      const result = await updatePaymentAccountAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Account mapping saved.");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">Payment accounts</h3>
        <p className="mt-1 text-sm text-slate-500">
          Map each owner UPI ID or QR image to Joint, Kasi, Kanthu, or Pratyu.
          Per-flat UPI and QR are edited in the section below. Rent received via
          a flat&apos;s QR auto-tags the matching account unless you set
          &quot;Credit to account&quot; on that flat.
        </p>
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mx-5 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-6">
          {success}
        </p>
      ) : null}

      {loadError ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {tableMissing
            ? "Payment accounts table is missing. Run supabase/migrations/20260829_building_revenue_accounts.sql and 20260829_payment_accounts_rls.sql in Supabase SQL Editor."
            : loadError}
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-slate-600">
            No accounts loaded yet. If you already ran the migrations, click
            below to create Joint, Kasi, Kanthu, and Pratyu.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError("");
              setSuccess("");
              startTransition(async () => {
                const result = await ensurePaymentAccountsAction();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSuccess("Owner accounts created.");
                router.refresh();
              });
            }}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Setting up…" : "Set up owner accounts"}
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {accounts.map((account) => (
          <li key={account.id} className="px-5 py-5 sm:px-6">
            <form
              onSubmit={(event) => handleSubmit(event, account.id)}
              className="grid gap-4 lg:grid-cols-2"
            >
              <input type="hidden" name="id" value={account.id} />
              <div>
                <p className="font-semibold text-slate-900">{account.label}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Code: {account.code}
                </p>
              </div>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Display label
                </span>
                <input
                  name="label"
                  required
                  defaultValue={account.label}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  UPI ID
                </span>
                <input
                  name="upi_id"
                  defaultValue={account.upiId ?? ""}
                  placeholder="name@bank"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  QR image URL
                </span>
                <input
                  name="upi_qr_url"
                  defaultValue={account.upiQrUrl ?? ""}
                  placeholder="/upi/default-receive-qr.png"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Default for building
                </span>
                <select
                  name="building_wing"
                  defaultValue={account.buildingWing ?? ""}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="">Any / not building-specific</option>
                  <option value="C">Building C flats</option>
                  <option value="D">Building D flats</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes
                </span>
                <input
                  name="notes"
                  defaultValue={account.notes ?? ""}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={pending && pendingId === account.id}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending && pendingId === account.id ? "Saving…" : "Save mapping"}
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
