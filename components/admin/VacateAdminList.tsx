"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVacateStatusAction } from "@/app/admin/ops-actions";

type VacateRow = {
  id: string;
  tenantName: string;
  flatNumber: string;
  status: string;
  reason: string | null;
};

export default function VacateAdminList({ rows }: { rows: VacateRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onStatus(id: string, status: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("status", status);
    startTransition(async () => {
      await updateVacateStatusAction(formData);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="p-6 text-sm text-slate-500">No vacate requests.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-semibold text-slate-900">
              {row.tenantName} · Flat {row.flatNumber}
            </p>
            {row.reason ? (
              <p className="mt-1 text-sm text-slate-500">{row.reason}</p>
            ) : null}
          </div>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={row.status}
            disabled={pending}
            onChange={(e) => onStatus(row.id, e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </li>
      ))}
    </ul>
  );
}
