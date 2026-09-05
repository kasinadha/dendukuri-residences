"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateFlatUpiMappingAction,
  updateFlatUpiMappingForWingAction,
} from "@/app/admin/accounts/actions";
import AccountSelectField from "@/components/admin/AccountSelectField";
import {
  buildingWingFromFlatNumber,
  buildingWingLabel,
  type BuildingWing,
} from "@/lib/building-wing";
import type { FlatUpiMapping } from "@/lib/flats";
import { formatActionError } from "@/lib/format-action-error";
import type { PaymentAccountOption } from "@/lib/payment-accounts";
import { buildUpiQrImageUrl } from "@/lib/rent-upi";

function previewQrUrl(upiId: string | null, upiQrUrl: string | null): string | null {
  if (upiQrUrl?.trim()) return upiQrUrl.trim();
  if (upiId?.trim()) {
    return buildUpiQrImageUrl(`upi://pay?pa=${upiId.trim()}`, 96);
  }
  return null;
}

function WingGroup({
  wing,
  flats,
  accounts,
  pending,
  busyId,
  onSaveFlat,
  onApplyWing,
}: {
  wing: BuildingWing | "other";
  flats: FlatUpiMapping[];
  accounts: PaymentAccountOption[];
  pending: boolean;
  busyId: string | null;
  onSaveFlat: (event: FormEvent<HTMLFormElement>, flatId: string) => void;
  onApplyWing: (event: FormEvent<HTMLFormElement>, wing: BuildingWing) => void;
}) {
  const title = wing === "other" ? "Other flats" : buildingWingLabel(wing);

  return (
    <div className="border-t border-slate-100">
      <div className="px-5 py-4 sm:px-6">
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm text-slate-500">
          {flats.length} flat{flats.length === 1 ? "" : "s"}. Empty UPI falls
          back to the Joint account above.
        </p>
      </div>

      {wing === "C" || wing === "D" ? (
        <form
          onSubmit={(event) => onApplyWing(event, wing)}
          className="mx-5 mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:mx-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="wing" value={wing} />
          <p className="sm:col-span-2 lg:col-span-4 text-sm font-semibold text-slate-800">
            Apply to every {title} flat
          </p>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              UPI ID
            </span>
            <input
              name="upi_id"
              placeholder="Same UPI for all flats in this building"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              QR image URL
            </span>
            <input
              name="upi_qr_url"
              placeholder="/upi/building-qr.png"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </label>
          <AccountSelectField
            name="payment_account_id"
            accounts={accounts}
            label="Credit to account"
            defaultValue=""
            emptyLabel="Leave unchanged / Joint"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending && busyId === `wing-${wing}`}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending && busyId === `wing-${wing}`
                ? "Applying…"
                : `Apply to Building ${wing}`}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {flats.map((flat) => {
          const qr = previewQrUrl(flat.upiId, flat.upiQrUrl);
          return (
            <li key={flat.id} className="px-5 py-5 sm:px-6">
              <form
                onSubmit={(event) => onSaveFlat(event, flat.id)}
                className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]"
              >
                <input type="hidden" name="flat_id" value={flat.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="font-semibold text-slate-900">
                      Flat {flat.flatNumber}
                      {flat.tenantName ? ` · ${flat.tenantName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {flat.isOccupied ? "Occupied" : "Vacant"}
                      {flat.upiId ? ` · ${flat.upiId}` : " · no UPI yet"}
                    </p>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      UPI ID
                    </span>
                    <input
                      name="upi_id"
                      defaultValue={flat.upiId ?? ""}
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
                      defaultValue={flat.upiQrUrl ?? ""}
                      placeholder="/upi/c201-qr.png"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <AccountSelectField
                      name="payment_account_id"
                      accounts={accounts}
                      label="Credit to account"
                      hint="Leave empty to match by UPI ID, then Joint."
                      defaultValue={flat.paymentAccountId ?? ""}
                      emptyLabel="Use UPI match / Joint"
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={pending && busyId === flat.id}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pending && busyId === flat.id ? "Saving…" : "Save flat"}
                    </button>
                  </div>
                </div>
                <div className="flex items-start justify-center lg:justify-end">
                  {qr ? (
                    // External or generated QR; not a next/image remote host list.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr}
                      alt={`UPI QR for flat ${flat.flatNumber}`}
                      width={96}
                      height={96}
                      className="rounded-xl border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <p className="text-xs text-slate-400">No QR yet</p>
                  )}
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function FlatUpiAccountsPanel({
  flats,
  accounts,
}: {
  flats: FlatUpiMapping[];
  accounts: PaymentAccountOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<BuildingWing | "other", FlatUpiMapping[]> = {
      C: [],
      D: [],
      other: [],
    };
    for (const flat of flats) {
      const wing = buildingWingFromFlatNumber(flat.flatNumber);
      if (wing === "C" || wing === "D") groups[wing].push(flat);
      else groups.other.push(flat);
    }
    return groups;
  }, [flats]);

  function saveFlat(event: FormEvent<HTMLFormElement>, flatId: string) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusyId(flatId);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await updateFlatUpiMappingAction(formData);
        setBusyId(null);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess(`Saved UPI for this flat.`);
        router.refresh();
      } catch (err) {
        setBusyId(null);
        setError(formatActionError(err, "Could not save the flat UPI details."));
      }
    });
  }

  function applyWing(event: FormEvent<HTMLFormElement>, wing: BuildingWing) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const upi = String(formData.get("upi_id") ?? "").trim();
    const qr = String(formData.get("upi_qr_url") ?? "").trim();
    if (!upi && !qr && !String(formData.get("payment_account_id") ?? "").trim()) {
      setError("Enter a UPI ID, QR URL, or account before applying to the building.");
      return;
    }
    if (
      !window.confirm(
        `Apply these UPI / QR details to every Building ${wing} flat? This overwrites each flat’s current UPI and QR.`
      )
    ) {
      return;
    }
    setError("");
    setSuccess("");
    setBusyId(`wing-${wing}`);
    startTransition(async () => {
      try {
        const result = await updateFlatUpiMappingForWingAction(formData);
        setBusyId(null);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess(
          `Updated ${result.updated} Building ${wing} flat${result.updated === 1 ? "" : "s"}.`
        );
        router.refresh();
      } catch (err) {
        setBusyId(null);
        setError(formatActionError(err, "Could not update building UPI details."));
      }
    });
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">Per-flat UPI & QR</h3>
        <p className="mt-1 text-sm text-slate-500">
          Set a receive UPI ID and QR for each flat. Tenants and the public pay
          page use the flat’s details first, then the Joint account. You can
          also push the same UPI/QR to every flat in Building C or D.
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

      {flats.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No flats loaded yet.</p>
      ) : (
        <>
          {grouped.C.length ? (
            <WingGroup
              wing="C"
              flats={grouped.C}
              accounts={accounts}
              pending={pending}
              busyId={busyId}
              onSaveFlat={saveFlat}
              onApplyWing={applyWing}
            />
          ) : null}
          {grouped.D.length ? (
            <WingGroup
              wing="D"
              flats={grouped.D}
              accounts={accounts}
              pending={pending}
              busyId={busyId}
              onSaveFlat={saveFlat}
              onApplyWing={applyWing}
            />
          ) : null}
          {grouped.other.length ? (
            <WingGroup
              wing="other"
              flats={grouped.other}
              accounts={accounts}
              pending={pending}
              busyId={busyId}
              onSaveFlat={saveFlat}
              onApplyWing={applyWing}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
