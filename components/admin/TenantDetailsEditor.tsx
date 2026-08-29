"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTenantDetailsAction,
  updateTenantTermsAction,
} from "@/app/admin/tenants/actions";
import { formatInr } from "@/lib/receipts";
import type { TenantMonthlyCharges } from "@/lib/tenant-charges";

type Props = {
  tenantId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
  depositPaid: number | null;
  depositPaidDate: string | null;
  monthlyCharges: TenantMonthlyCharges | null;
  tenancyId: string | null;
  hasActiveTenancy: boolean;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function describeAmount(value: number | null): string {
  return value != null ? formatInr(value) : "—";
}

export default function TenantDetailsEditor({
  tenantId,
  fullName,
  phone,
  email,
  monthlyRent,
  depositAmount,
  depositPaid,
  depositPaidDate,
  monthlyCharges,
  tenancyId,
  hasActiveTenancy,
}: Props) {
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const balance =
    depositAmount != null && depositPaid != null
      ? depositAmount - depositPaid
      : null;

  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    formData.set("tenant_id", tenantId);

    startTransition(async () => {
      const result = await updateTenantDetailsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Contact details saved.");
      setContactOpen(false);
      router.refresh();
    });
  }

  function handleTermsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!tenancyId) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("tenancy_id", tenancyId);

    const nextRent = formData.get("monthly_rent");
    const nextDeposit = formData.get("deposit_amount");
    const nextPaid = formData.get("deposit_paid");
    const nextPaidDate = formData.get("deposit_paid_date");
    const nextMaintenance = formData.get("maintenance_charge");
    const nextParking = formData.get("car_parking_charge");
    const nextWasher = formData.get("washing_machine_charge");
    const nextOther = formData.get("other_monthly_charge");
    const nextOtherNotes = formData.get("other_charges_notes");

    const rentChanged =
      String(nextRent ?? "") !==
      (monthlyRent != null ? String(monthlyRent) : "");
    const depositChanged =
      String(nextDeposit ?? "") !==
      (depositAmount != null ? String(depositAmount) : "");
    const paidChanged =
      String(nextPaid ?? "") !==
      (depositPaid != null ? String(depositPaid) : "");
    const dateChanged =
      String(nextPaidDate ?? "") !== (depositPaidDate ?? "");
    const maintenanceChanged =
      String(nextMaintenance ?? "") !==
      String(monthlyCharges?.maintenanceCharge ?? 0);
    const parkingChanged =
      String(nextParking ?? "") !==
      String(monthlyCharges?.carParkingCharge ?? 0);
    const washerChanged =
      String(nextWasher ?? "") !==
      String(monthlyCharges?.washingMachineCharge ?? 0);
    const otherChanged =
      String(nextOther ?? "") !==
      String(monthlyCharges?.otherMonthlyCharge ?? 0);
    const otherNotesChanged =
      String(nextOtherNotes ?? "") !==
      (monthlyCharges?.otherChargesNotes ?? "");

    const hasFinancialChange =
      rentChanged ||
      depositChanged ||
      paidChanged ||
      dateChanged ||
      maintenanceChanged ||
      parkingChanged ||
      washerChanged ||
      otherChanged ||
      otherNotesChanged;

    if (!hasFinancialChange) {
      setSuccess("No changes to tenancy terms.");
      setTermsOpen(false);
      setTermsConfirmed(false);
      return;
    }

    if (!termsConfirmed) {
      setError("Check the confirmation box before saving locked terms.");
      return;
    }

    const lines = [
        "You are about to change locked tenancy terms:",
        rentChanged
          ? `• Rent: ${describeAmount(monthlyRent)} → ${describeAmount(
              nextRent ? Number(nextRent) : null
            )}`
          : null,
        depositChanged
          ? `• Advance agreed: ${describeAmount(depositAmount)} → ${describeAmount(
              nextDeposit ? Number(nextDeposit) : null
            )}`
          : null,
        paidChanged
          ? `• Advance paid: ${describeAmount(depositPaid)} → ${describeAmount(
              nextPaid ? Number(nextPaid) : null
            )}`
          : null,
        dateChanged
          ? `• Advance paid date: ${formatShortDate(depositPaidDate)} → ${formatShortDate(
              typeof nextPaidDate === "string" ? nextPaidDate : null
            )}`
          : null,
        maintenanceChanged
          ? `• Maintenance: ${describeAmount(monthlyCharges?.maintenanceCharge ?? 0)} → ${describeAmount(
              nextMaintenance ? Number(nextMaintenance) : 0
            )}`
          : null,
        parkingChanged
          ? `• Car parking: ${describeAmount(monthlyCharges?.carParkingCharge ?? 0)} → ${describeAmount(
              nextParking ? Number(nextParking) : 0
            )}`
          : null,
        washerChanged
          ? `• Washing machine: ${describeAmount(monthlyCharges?.washingMachineCharge ?? 0)} → ${describeAmount(
              nextWasher ? Number(nextWasher) : 0
            )}`
          : null,
        otherChanged
          ? `• Other charges: ${describeAmount(monthlyCharges?.otherMonthlyCharge ?? 0)} → ${describeAmount(
              nextOther ? Number(nextOther) : 0
            )}`
          : null,
        otherNotesChanged
          ? `• Other notes: ${monthlyCharges?.otherChargesNotes || "—"} → ${
              typeof nextOtherNotes === "string" && nextOtherNotes.trim()
                ? nextOtherNotes.trim()
                : "—"
            }`
          : null,
      ].filter(Boolean);

    const ok = window.confirm(`${lines.join("\n")}\n\nSave these changes?`);
    if (!ok) return;
    formData.set("terms_confirmed", "yes");

    startTransition(async () => {
      const result = await updateTenantTermsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Tenancy terms updated.");
      setTermsOpen(false);
      setTermsConfirmed(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {hasActiveTenancy ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">Locked terms</p>
          <p className="mt-1">
            Rent {describeAmount(monthlyRent)}
          </p>
          <p>
            Advance {describeAmount(depositAmount)} agreed
          </p>
          <p>
            Paid {describeAmount(depositPaid)}
            {depositPaidDate ? ` · ${formatShortDate(depositPaidDate)}` : ""}
          </p>
          {monthlyCharges ? (
            <>
              <p className="mt-2 font-semibold text-slate-800">Monthly charges</p>
              <p>
                Total {formatInr(monthlyCharges.totalMonthlyCharges)}/mo
              </p>
              <p>
                Maint {describeAmount(monthlyCharges.maintenanceCharge)} · Park{" "}
                {describeAmount(monthlyCharges.carParkingCharge)} · Washer{" "}
                {describeAmount(monthlyCharges.washingMachineCharge)}
              </p>
              {(monthlyCharges.otherMonthlyCharge > 0 ||
                monthlyCharges.otherChargesNotes) && (
                <p>
                  Other {describeAmount(monthlyCharges.otherMonthlyCharge)}
                  {monthlyCharges.otherChargesNotes
                    ? ` · ${monthlyCharges.otherChargesNotes}`
                    : ""}
                </p>
              )}
            </>
          ) : null}
          {balance != null && balance > 0 ? (
            <p className="mt-1 font-semibold text-amber-800">
              Advance balance {formatInr(balance)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setContactOpen((value) => !value);
            setTermsOpen(false);
            setError("");
            setSuccess("");
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {contactOpen ? "Close" : "Edit contact"}
        </button>

        {hasActiveTenancy && tenancyId ? (
          <button
            type="button"
            onClick={() => {
              setTermsOpen((value) => !value);
              setContactOpen(false);
              setTermsConfirmed(false);
              setError("");
              setSuccess("");
            }}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {termsOpen ? "Close" : "Edit terms & charges"}
          </button>
        ) : null}
      </div>

      {success && !contactOpen && !termsOpen ? (
        <p className="text-xs text-emerald-700">{success}</p>
      ) : null}

      {contactOpen ? (
        <form
          onSubmit={handleContactSubmit}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <p className="text-xs font-semibold text-slate-700">
            Contact details (not portal login)
          </p>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Full name
              </span>
              <input
                name="full_name"
                required
                defaultValue={fullName !== "—" ? fullName : ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Mobile
              </span>
              <input
                name="phone"
                defaultValue={phone ?? ""}
                placeholder="10-digit mobile"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Contact email (optional)
              </span>
              <input
                type="email"
                name="email"
                defaultValue={email ?? ""}
                placeholder="Not the portal login email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {error && contactOpen ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save contact"}
          </button>
        </form>
      ) : null}

      {termsOpen && hasActiveTenancy && tenancyId ? (
        <form
          onSubmit={handleTermsSubmit}
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"
        >
          <p className="text-xs font-semibold text-amber-950">
            Rent, advance & monthly charges (locked)
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            Changes are recorded on the active tenancy. You must confirm before
            saving.
          </p>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Monthly rent (₹)
              </span>
              <input
                type="number"
                name="monthly_rent"
                min={0}
                step={1}
                defaultValue={
                  monthlyRent != null ? String(monthlyRent) : ""
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Advance agreed (₹)
              </span>
              <input
                type="number"
                name="deposit_amount"
                min={0}
                step={1}
                defaultValue={
                  depositAmount != null ? String(depositAmount) : ""
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Advance paid (₹)
              </span>
              <input
                type="number"
                name="deposit_paid"
                min={0}
                step={1}
                defaultValue={
                  depositPaid != null ? String(depositPaid) : ""
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Advance paid date (final installment)
              </span>
              <input
                type="date"
                name="deposit_paid_date"
                defaultValue={depositPaidDate ?? ""}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <p className="text-xs font-semibold text-slate-700">
              Monthly charges (₹/month)
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Maintenance
              </span>
              <input
                type="number"
                name="maintenance_charge"
                min={0}
                step={1}
                defaultValue={String(monthlyCharges?.maintenanceCharge ?? 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Car parking
              </span>
              <input
                type="number"
                name="car_parking_charge"
                min={0}
                step={1}
                defaultValue={String(monthlyCharges?.carParkingCharge ?? 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Washing machine
              </span>
              <input
                type="number"
                name="washing_machine_charge"
                min={0}
                step={1}
                defaultValue={String(monthlyCharges?.washingMachineCharge ?? 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Other monthly
              </span>
              <input
                type="number"
                name="other_monthly_charge"
                min={0}
                step={1}
                defaultValue={String(monthlyCharges?.otherMonthlyCharge ?? 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Other charges note (optional)
              </span>
              <input
                name="other_charges_notes"
                defaultValue={monthlyCharges?.otherChargesNotes ?? ""}
                placeholder="e.g. extra amenity"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={termsConfirmed}
                onChange={(event) => setTermsConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm these tenancy term changes are intentional and
                necessary.
              </span>
            </label>
          </div>

          {error && termsOpen ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save terms & charges"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
