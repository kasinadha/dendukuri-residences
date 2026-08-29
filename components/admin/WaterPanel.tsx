"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWaterTankerAction,
  updateWaterTankerAction,
  updateWaterTankerPaymentStatusAction,
} from "@/app/admin/ops-actions";
import AccountSelectField from "@/components/admin/AccountSelectField";
import ExpenseLocationFields from "@/components/admin/ExpenseLocationFields";
import { formatActionError } from "@/lib/format-action-error";
import type {
  ExpenseBuildingWing,
  FlatLocationOption,
} from "@/lib/expense-location";
import type { PaymentAccountOption } from "@/lib/payment-accounts";

type VendorOption = { id: string; label: string };
type WaterRow = {
  id: string;
  deliveryDate: string;
  deliveryDateIso: string;
  amount: number | null;
  amountLabel: string;
  vendorId: string | null;
  vendorName: string;
  paymentStatus: string;
  buildingWing: ExpenseBuildingWing | null;
  flatId: string | null;
  locationLabel: string;
  payerAccountId: string | null;
  payerLabel: string | null;
  notes: string | null;
};

function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isPaidStatus(status: string): boolean {
  return status.trim().toLowerCase() === "paid";
}

export default function WaterPanel({
  vendors,
  rows,
  accounts,
  flats,
}: {
  vendors: VendorOption[];
  rows: WaterRow[];
  accounts: PaymentAccountOption[];
  flats: FlatLocationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listError, setListError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const result = await createWaterTankerAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Tanker order saved.");
        form.reset();
        router.refresh();
      } catch (err) {
        setError(formatActionError(err));
      }
    });
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setListError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const result = await updateWaterTankerAction(formData);
        if (!result.ok) {
          setListError(result.error);
          return;
        }
        setEditingId(null);
        setSuccess("Order updated.");
        router.refresh();
      } catch (err) {
        setListError(formatActionError(err));
      }
    });
  }

  function setPaymentStatus(id: string, paymentStatus: "paid" | "pending") {
    setListError("");
    const formData = new FormData();
    formData.set("id", id);
    formData.set("payment_status", paymentStatus);
    startTransition(async () => {
      try {
        const result = await updateWaterTankerPaymentStatusAction(formData);
        if (!result.ok) {
          setListError(result.error);
          return;
        }
        setSuccess(
          paymentStatus === "paid"
            ? "Marked as paid."
            : "Payment overridden to pending."
        );
        router.refresh();
      } catch (err) {
        setListError(formatActionError(err));
      }
    });
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Record tanker</h3>
        <p className="mt-1 text-sm text-slate-500">
          Include building, optional flat, and who paid.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ExpenseLocationFields
            flats={flats}
            buildingRequired
            flatHint="Optional — whole building or common area if blank."
          />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Delivery date
            </span>
            <input
              type="date"
              name="delivery_date"
              required
              defaultValue={todayIsoDate()}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Amount (₹)
            </span>
            <input
              type="number"
              name="amount"
              min={0}
              step={1}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Vendor
            </span>
            <select
              name="vendor_id"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              defaultValue=""
            >
              <option value="">Optional</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Payment status
            </span>
            <select
              name="payment_status"
              defaultValue="pending"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <AccountSelectField
              accounts={accounts}
              name="payer_account_id"
              label="Paid by (account)"
              hint="Who paid for this tanker — Joint, Kasi, Kanthu, or Pratyu."
              required
              allowEmpty={false}
            />
          </div>
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
          {pending ? "Saving…" : "Save order"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Orders</h3>
          <p className="mt-1 text-sm text-slate-500">
            Edit any order, including overriding paid → pending.
          </p>
        </div>
        {listError ? (
          <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {listError}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tanker orders yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const paid = isPaidStatus(row.paymentStatus);
              const editing = editingId === row.id;
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.deliveryDate} · {row.amountLabel}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {row.locationLabel} · {row.vendorName} ·{" "}
                        <span
                          className={
                            paid
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-amber-700"
                          }
                        >
                          {row.paymentStatus}
                        </span>
                        {row.payerLabel ? ` · Paid by ${row.payerLabel}` : ""}
                      </p>
                      {row.notes ? (
                        <p className="mt-1 text-sm text-slate-600">{row.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {paid ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setPaymentStatus(row.id, "pending")}
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
                        >
                          Override → pending
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setPaymentStatus(row.id, "paid")}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Mark paid
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          setEditingId(editing ? null : row.id)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {editing ? "Close" : "Edit"}
                      </button>
                    </div>
                  </div>

                  {editing ? (
                    <form
                      onSubmit={handleUpdate}
                      className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <ExpenseLocationFields
                        flats={flats}
                        buildingRequired
                        defaultBuilding={row.buildingWing ?? ""}
                        defaultFlatId={row.flatId ?? ""}
                        flatHint="Optional — whole building or common area if blank."
                      />
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Delivery date
                        </span>
                        <input
                          type="date"
                          name="delivery_date"
                          required
                          defaultValue={row.deliveryDateIso}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Amount (₹)
                        </span>
                        <input
                          type="number"
                          name="amount"
                          min={0}
                          step={1}
                          defaultValue={row.amount ?? ""}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Vendor
                        </span>
                        <select
                          name="vendor_id"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          defaultValue={row.vendorId ?? ""}
                        >
                          <option value="">Optional</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Payment status
                        </span>
                        <select
                          name="payment_status"
                          defaultValue={
                            isPaidStatus(row.paymentStatus) ? "paid" : "pending"
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </label>
                      <div className="sm:col-span-2">
                        <AccountSelectField
                          accounts={accounts}
                          name="payer_account_id"
                          label="Paid by (account)"
                          required
                          allowEmpty={false}
                          defaultValue={row.payerAccountId ?? ""}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Notes
                        </span>
                        <textarea
                          name="notes"
                          rows={2}
                          defaultValue={row.notes ?? ""}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pending ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setEditingId(null)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
