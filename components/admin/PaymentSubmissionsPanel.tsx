"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePaymentSubmissionAction,
  rejectPaymentSubmissionAction,
} from "@/app/admin/payments/actions";
import type { PaymentSubmission } from "@/lib/payment-submissions";
import {
  resolvePaymentAccountFromUpi,
  toPaymentAccountOptions,
  type PaymentAccount,
} from "@/lib/payment-accounts";
import { purposeLabel } from "@/lib/public-pay";
import { formatBillingMonthLabel, formatInr } from "@/lib/receipts";

type Props = {
  submissions: PaymentSubmission[];
  accounts: PaymentAccount[];
};

export default function PaymentSubmissionsPanel({
  submissions,
  accounts,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const accountOptions = toPaymentAccountOptions(accounts);

  function approve(id: string, receiverAccountId: string, amount: string) {
    setError("");
    setMessage("");
    setPendingId(id);
    const formData = new FormData();
    formData.set("id", id);
    if (receiverAccountId) {
      formData.set("receiver_account_id", receiverAccountId);
    }
    if (amount.trim()) {
      formData.set("amount", amount.trim());
    }
    startTransition(async () => {
      const result = await approvePaymentSubmissionAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.claimOnly) {
        setMessage(
          "Approved as claim only (no tenancy on flat — no receipt created)."
        );
      } else {
        setMessage(`Approved — receipt ${result.receiptNumber} created.`);
      }
      router.refresh();
    });
  }

  function reject(id: string) {
    setError("");
    setMessage("");
    setPendingId(id);
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      const result = await rejectPaymentSubmissionAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Submission rejected.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">
          Pending UTR confirmations
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Includes tenant portal submissions and public (no-login) claims.
          Approve to create payment + receipt when a tenancy exists. Confirm
          which account received the money (auto-matched from UPI/QR when
          mapped).
        </p>
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mx-5 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-6">
          {message}
        </p>
      ) : null}

      {submissions.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No pending submissions.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {submissions.map((row) => {
            const suggested = resolvePaymentAccountFromUpi(accounts, {
              upiId: row.upiId,
            });
            return (
              <SubmissionRow
                key={row.id}
                row={row}
                accountOptions={accountOptions}
                suggestedAccountId={suggested?.id ?? ""}
                pending={pending && pendingId === row.id}
                onApprove={approve}
                onReject={reject}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SubmissionRow({
  row,
  accountOptions,
  suggestedAccountId,
  pending,
  onApprove,
  onReject,
}: {
  row: PaymentSubmission;
  accountOptions: ReturnType<typeof toPaymentAccountOptions>;
  suggestedAccountId: string;
  pending: boolean;
  onApprove: (id: string, receiverAccountId: string, amount: string) => void;
  onReject: (id: string) => void;
}) {
  const [receiverAccountId, setReceiverAccountId] = useState(
    suggestedAccountId
  );
  const [amount, setAmount] = useState(
    row.amount > 0 ? String(row.amount) : ""
  );

  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            Flat {row.flatNumber} · {purposeLabel(row.purpose)}
            {row.isPublicClaim ? (
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Public claim
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {row.payerName
              ? `${row.payerName}${
                  row.payerPhone ? ` · ${row.payerPhone}` : ""
                }`
              : row.tenantName}
            {row.billingMonth
              ? ` · ${formatBillingMonthLabel(row.billingMonth)}`
              : ""}{" "}
            · {formatInr(row.amount)} · UTR {row.utr}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Paid {row.paymentDate}
            {row.upiId ? ` · UPI ${row.upiId}` : ""}
            {!row.tenancyId ? " · no tenancy linked yet" : ""}
            {row.notes ? ` · ${row.notes}` : ""}
          </p>
          {row.proofUrl ? (
            <a
              href={row.proofUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block overflow-hidden rounded-xl border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.proofUrl}
                alt={`Payment proof for UTR ${row.utr}`}
                className="max-h-48 w-auto max-w-full object-contain"
              />
            </a>
          ) : (
            <p className="mt-2 text-xs text-slate-400">No screenshot</p>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-xs">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Claimed amount (₹)
            </span>
            <input
              type="number"
              min={1}
              step={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Override here if the tenant entered the wrong amount.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Received into
            </span>
            <select
              value={receiverAccountId}
              onChange={(e) => setReceiverAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onApprove(row.id, receiverAccountId, amount)}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onReject(row.id)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
