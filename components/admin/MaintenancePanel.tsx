"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMaintenanceAction,
  updateMaintenanceStatusAction,
} from "@/app/admin/maintenance/actions";
import AccountSelectField from "@/components/admin/AccountSelectField";
import {
  filterFlatsByBuilding,
  type FlatLocationOption,
} from "@/lib/expense-location";
import type { BuildingWing } from "@/lib/building-wing";
import type { PaymentAccountOption } from "@/lib/payment-accounts";

type RequestRow = {
  id: string;
  flatNumber: string;
  buildingLabel: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  costLabel: string;
  category: string | null;
  payerLabel: string | null;
};

export default function MaintenancePanel({
  flats,
  requests,
  accounts,
}: {
  flats: FlatLocationOption[];
  requests: RequestRow[];
  accounts: PaymentAccountOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [building, setBuilding] = useState<BuildingWing | "">("");

  const filteredFlats = useMemo(
    () => filterFlatsByBuilding(flats, building || "all"),
    [flats, building]
  );

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createMaintenanceAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Request created.");
      event.currentTarget.reset();
      setBuilding("");
      router.refresh();
    });
  }

  function handleStatus(id: string, status: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("status", status);
    startTransition(async () => {
      const result = await updateMaintenanceStatusAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">New request</h3>
        <p className="mt-1 text-sm text-slate-500">
          Select building and flat, then record who paid.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Building
            </span>
            <select
              required
              value={building}
              onChange={(event) =>
                setBuilding(event.target.value as BuildingWing | "")
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Select building</option>
              <option value="C">Building C</option>
              <option value="D">Building D</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Flat
            </span>
            <select
              name="flat_id"
              required
              disabled={!building || filteredFlats.length === 0}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              defaultValue=""
            >
              <option value="">
                {!building
                  ? "Select building first"
                  : filteredFlats.length === 0
                    ? "No flats in this building"
                    : "Select flat"}
              </option>
              {filteredFlats.map((flat) => (
                <option key={flat.id} value={flat.id}>
                  {flat.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Title
            </span>
            <input
              name="title"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Priority
            </span>
            <select
              name="priority"
              defaultValue="normal"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </span>
            <input
              name="category"
              placeholder="plumbing / electrical"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Cost (₹)
            </span>
            <input
              type="number"
              name="cost"
              min={0}
              step={1}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <AccountSelectField
              accounts={accounts}
              name="payer_account_id"
              label="Paid by (account)"
              hint="Who paid for this repair — Joint, Kasi, Kanthu, or Pratyu."
              required
              allowEmpty={false}
            />
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Description
            </span>
            <textarea
              name="description"
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
          disabled={pending || flats.length === 0}
          className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create request"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Requests</h3>
        </div>
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No maintenance requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((row) => (
              <li key={row.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{row.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.buildingLabel} · Flat {row.flatNumber} · {row.priority}
                      {row.category ? ` · ${row.category}` : ""}
                      {row.payerLabel ? ` · Paid by ${row.payerLabel}` : ""}
                    </p>
                    {row.description ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-sm font-semibold text-slate-900">
                      {row.costLabel}
                    </p>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={row.status}
                      disabled={pending}
                      onChange={(e) => handleStatus(row.id, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
