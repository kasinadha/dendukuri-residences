"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWaterTankerPaymentStatusAction } from "@/app/admin/ops-actions";
import { formatInr } from "@/lib/receipts";
import type { OwnerDueItem } from "@/lib/reminders";

export default function OwnerDuesRemindersPanel({
  items,
}: {
  items: OwnerDueItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function markWaterPaid(id: string) {
    setError("");
    setPendingId(id);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("payment_status", "paid");
    startTransition(async () => {
      const result = await updateWaterTankerPaymentStatusAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">Your dues</h3>
        <p className="mt-1 text-sm text-slate-500">
          Owner payables — unpaid water tankers and open maintenance with cost.
        </p>
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="p-6 text-sm text-emerald-800">
          No open owner dues right now.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const busy = pending && pendingId === item.id;
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.detail}
                    {item.amount != null ? ` · ${formatInr(item.amount)}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.kind === "water" ? "Water" : "Maintenance"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.kind === "water" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => markWaterPaid(item.id)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Mark paid"}
                    </button>
                  ) : null}
                  <Link
                    href={item.href}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
