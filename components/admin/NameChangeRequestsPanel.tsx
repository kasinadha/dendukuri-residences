"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  rejectNameChangeAction,
  approveNameChangeAction,
} from "@/app/admin/tenants/actions";
import type { TenantChangeRequest } from "@/lib/tenant-change-requests";

export default function NameChangeRequestsPanel({
  rows,
}: {
  rows: TenantChangeRequest[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function decide(id: string, decision: "approved" | "rejected", adminNote?: string) {
    setError("");
    setBusyId(id);
    const formData = new FormData();
    formData.set("id", id);
    if (adminNote) formData.set("admin_note", adminNote);
    startTransition(async () => {
      const result =
        decision === "approved"
          ? await approveNameChangeAction(formData)
          : await rejectNameChangeAction(formData);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onReject(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    decide(id, "rejected", String(formData.get("admin_note") ?? ""));
  }

  if (rows.length === 0) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-100 px-5 py-4">
        <h3 className="text-lg font-bold text-amber-950">
          Name changes waiting for approval
        </h3>
        <p className="mt-1 text-sm text-amber-900">
          Approving updates both the tenant record and the portal login name.
        </p>
      </div>
      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-amber-100">
        {rows.map((row) => {
          const busy = pending && busyId === row.id;
          return (
            <li key={row.id} className="px-5 py-4">
              <p className="font-semibold text-slate-900">{row.tenantName}</p>
              <p className="mt-1 text-sm text-slate-700">
                {row.currentValue || "—"} →{" "}
                <span className="font-semibold">{row.requestedValue}</span>
              </p>
              {row.tenantNote ? (
                <p className="mt-1 text-xs text-slate-600">{row.tenantNote}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(row.id, "approved")}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Approve"}
                </button>
                <form
                  onSubmit={(event) => onReject(event, row.id)}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input
                    name="admin_note"
                    placeholder="Reason if rejecting"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
