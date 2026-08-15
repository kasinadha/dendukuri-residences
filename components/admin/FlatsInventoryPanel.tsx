"use client";

import { useState } from "react";
import FlatEditorForm from "@/components/admin/FlatEditorForm";
import type { FlatListItem } from "@/lib/flats";
import { formatInr } from "@/lib/receipts";

type Props = {
  flats: FlatListItem[];
};

function statusClasses(occupancy: string) {
  if (occupancy === "occupied") return "bg-emerald-50 text-emerald-800";
  if (occupancy === "reserved") return "bg-sky-50 text-sky-800";
  return "bg-amber-50 text-amber-800";
}

export default function FlatsInventoryPanel({ flats }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = flats.find((f) => f.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      {editing ? (
        <FlatEditorForm
          flat={editing}
          onCancelEdit={() => setEditingId(null)}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Inventory</h3>
          <p className="mt-1 text-sm text-slate-500">
            Live rows from Supabase. Edit floor, rent, deposit, UPI/QR, and
            notes.
          </p>
        </div>

        {flats.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No flats yet. Use Add flat to create the first real unit.
          </p>
        ) : (
          <>
            <div className="hidden border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid lg:gap-3 lg:px-6 xl:grid-cols-[0.8fr_0.7fr_0.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr]">
              <span>Flat</span>
              <span>Floor</span>
              <span>Status</span>
              <span>Rent</span>
              <span>Deposit</span>
              <span>Maint.</span>
              <span>Tenant</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100">
              {flats.map((flat) => (
                <li
                  key={flat.id}
                  className="grid gap-2 px-5 py-4 xl:grid-cols-[0.8fr_0.7fr_0.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr] xl:items-center xl:gap-3 xl:px-6"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {flat.flatNumber}
                    </p>
                    <p className="text-xs text-slate-500">{flat.type}</p>
                    {flat.upiId ? (
                      <p className="mt-1 break-all text-xs text-slate-400">
                        UPI {flat.upiId}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 xl:hidden">
                      Floor
                    </p>
                    <p className="text-sm text-slate-700">
                      {flat.floor ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(
                        flat.occupancy
                      )}`}
                    >
                      {flat.occupancy}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {flat.rent != null ? formatInr(flat.rent) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">
                      {flat.deposit != null ? formatInr(flat.deposit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">
                      {flat.maintenanceAmount != null
                        ? formatInr(flat.maintenanceAmount)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">
                      {flat.tenantName ?? "—"}
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setEditingId(flat.id)}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-600"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
