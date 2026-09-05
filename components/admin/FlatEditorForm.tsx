"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFlatAction,
  updateFlatAction,
} from "@/app/admin/flats/actions";
import type { FlatListItem } from "@/lib/flats";

type Props = {
  flat?: FlatListItem | null;
  onCancelEdit?: () => void;
};

const FLAT_TYPES = ["1BHK", "2BHK"] as const;
const STATUSES = ["vacant", "reserved", "occupied", "maintenance"] as const;

export default function FlatEditorForm({ flat, onCancelEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isEdit = Boolean(flat?.id);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = isEdit
        ? await updateFlatAction(formData)
        : await createFlatAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(isEdit ? "Flat updated." : "Flat saved to Supabase.");
      if (!isEdit) form.reset();
      onCancelEdit?.();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">
        {isEdit ? `Edit flat ${flat?.flatNumber}` : "Add flat"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Saved to Supabase for Dendukuri&apos;s Residences. Do not invent
        inventory — enter real units only.
      </p>

      {isEdit ? <input type="hidden" name="id" value={flat?.id} /> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-1">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Flat number
          </span>
          <input
            name="flat_number"
            required
            defaultValue={flat?.flatNumber !== "—" ? flat?.flatNumber : ""}
            placeholder="e.g. D201"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Flat type
          </span>
          <select
            name="flat_type"
            required
            defaultValue={
              flat?.type && flat.type !== "—" ? flat.type : "1BHK"
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {FLAT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Floor
          </span>
          <select
            name="floor"
            defaultValue={
              flat?.floor != null && flat.floor !== ""
                ? String(flat.floor)
                : ""
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">—</option>
            <option value="0">0 · Ground</option>
            <option value="1">1 · First</option>
            <option value="2">2 · Second</option>
            <option value="3">3 · Third</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Status
          </span>
          <select
            name="status"
            defaultValue={
              flat?.status &&
              STATUSES.includes(
                flat.status.toLowerCase() as (typeof STATUSES)[number]
              )
                ? flat.status.toLowerCase()
                : flat?.isOccupied
                  ? "occupied"
                  : "vacant"
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Monthly rent (₹)
          </span>
          <input
            name="monthly_rent"
            type="number"
            min="0"
            step="1"
            defaultValue={flat?.rent ?? ""}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Deposit (₹)
          </span>
          <input
            name="deposit"
            type="number"
            min="0"
            step="1"
            defaultValue={flat?.deposit ?? ""}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Maintenance amount (₹)
          </span>
          <input
            name="maintenance_amount"
            type="number"
            min="0"
            step="1"
            defaultValue={flat?.maintenanceAmount ?? ""}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Rent UPI ID (per flat)
          </span>
          <input
            name="upi_id"
            defaultValue={flat?.upiId ?? ""}
            placeholder="e.g. 9492883721-2@ybl"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Shown on the tenant pay page for this flat. Leave blank to use the
            global env UPI.
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            QR image URL (optional)
          </span>
          <input
            name="upi_qr_url"
            defaultValue={flat?.upiQrUrl ?? ""}
            placeholder="/upi/default-receive-qr.png"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Path or URL to the receive QR. Example bundled image:{" "}
            <code>/upi/default-receive-qr.png</code>. If empty, a QR is
            generated from the UPI ID.
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Notes
          </span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={flat?.notes ?? ""}
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

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : isEdit ? "Update flat" : "Create flat"}
        </button>
        {isEdit && onCancelEdit ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
