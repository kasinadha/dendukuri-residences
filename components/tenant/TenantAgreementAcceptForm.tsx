"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantAcceptAgreementAction } from "@/app/tenant/actions";
import type { TenancyAgreement } from "@/lib/agreements";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

export default function TenantAgreementAcceptForm({
  agreement,
}: {
  agreement: TenancyAgreement;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("agreement_id", agreement.id);
    startTransition(async () => {
      const result = await tenantAcceptAgreementAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const alreadyAccepted = agreement.tenantStatus === "accepted";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">Move-in date</span>
          <br />
          <span className="font-semibold text-slate-900">
            {agreement.moveInDate
              ? formatDisplayDate(agreement.moveInDate)
              : "Not recorded"}
          </span>
        </p>
        <p>
          <span className="text-slate-500">Monthly rent</span>
          <br />
          <span className="font-semibold text-slate-900">
            {formatInr(agreement.monthlyRent)}
          </span>
        </p>
        <p>
          <span className="text-slate-500">Maintenance</span>
          <br />
          <span className="font-semibold text-slate-900">
            {formatInr(agreement.maintenanceCharge)}
          </span>
        </p>
        <p>
          <span className="text-slate-500">Parking / washer / other</span>
          <br />
          <span className="font-semibold text-slate-900">
            {formatInr(
              agreement.carParkingCharge +
                agreement.washingMachineCharge +
                agreement.otherMonthlyCharge
            )}
          </span>
          {agreement.otherChargesNotes ? (
            <span className="block text-xs text-slate-500">
              {agreement.otherChargesNotes}
            </span>
          ) : null}
        </p>
        <p>
          <span className="text-slate-500">Deposit paid / agreed</span>
          <br />
          <span className="font-semibold text-slate-900">
            {formatInr(agreement.depositPaid)} / {formatInr(agreement.depositAmount)}
          </span>
        </p>
      </div>

      <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" name="check_rent" required disabled={alreadyAccepted} />
        I confirm the monthly rent amount.
      </label>
      <label className="flex gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="check_maintenance"
          required
          disabled={alreadyAccepted}
        />
        I confirm the maintenance charge.
      </label>
      <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" name="check_other" required disabled={alreadyAccepted} />
        I confirm parking, washing-machine, and other monthly charges.
      </label>
      <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" name="check_deposit" required disabled={alreadyAccepted} />
        I confirm the deposit / advance paid and agreed.
      </label>
      <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" name="check_terms" required disabled={alreadyAccepted} />
        I have read the general terms, including the waste-dumping fines.
      </label>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {alreadyAccepted ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You accepted these terms
          {agreement.acceptedAt
            ? ` on ${new Date(agreement.acceptedAt).toLocaleDateString("en-IN")}`
            : ""}
          .
        </p>
      ) : (
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Accept terms"}
        </button>
      )}
    </form>
  );
}
