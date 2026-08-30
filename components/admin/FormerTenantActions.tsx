"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveTenantAction,
  mergeDuplicateTenantAction,
  recordVacateDateAction,
} from "@/app/admin/tenants/actions";
import { todayIsoDate } from "@/lib/dates";
import { formatDisplayDate } from "@/lib/receipts";

type Props = {
  tenantId: string;
  tenantName: string;
  endedTenancyId: string | null;
  vacatedDate: string | null;
  lastFlatNumber: string | null;
  mergeTarget?: {
    canonicalTenantId: string;
    canonicalName: string;
    canonicalFlatNumber: string | null;
  } | null;
};

export default function FormerTenantActions({
  tenantId,
  tenantName,
  endedTenancyId,
  vacatedDate,
  lastFlatNumber,
  mergeTarget,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState<"vacate" | null>(null);

  function run(
    action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>,
    formData: FormData,
    okMessage: string
  ) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(okMessage);
      setOpen(null);
      router.refresh();
    });
  }

  function onRecordVacateDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(recordVacateDateAction, new FormData(event.currentTarget), "Vacate date saved.");
  }

  function onArchive() {
    if (
      !window.confirm(
        `Archive ${tenantName}? They will be hidden from the tenant list. Payment history is kept.`
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("tenant_id", tenantId);
    run(archiveTenantAction, formData, "Tenant archived.");
  }

  function onMergeDuplicate() {
    if (!mergeTarget) return;
    if (
      !window.confirm(
        `Merge ${tenantName} into ${mergeTarget.canonicalName}? The duplicate former record will be removed. History stays on the active tenant.`
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("stale_tenant_id", tenantId);
    formData.set("canonical_tenant_id", mergeTarget.canonicalTenantId);
    run(mergeDuplicateTenantAction, formData, "Duplicate tenant merged.");
  }

  return (
    <div className="space-y-2">
      {mergeTarget ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Same mobile as active tenant{" "}
          <span className="font-semibold">{mergeTarget.canonicalName}</span>
          {mergeTarget.canonicalFlatNumber
            ? ` (${mergeTarget.canonicalFlatNumber})`
            : ""}
          .
        </p>
      ) : null}
      {lastFlatNumber ? (
        <p className="text-xs text-slate-600">
          Last flat <span className="font-semibold">{lastFlatNumber}</span>
        </p>
      ) : null}
      {vacatedDate ? (
        <p className="text-xs font-semibold text-slate-700">
          Vacated {formatDisplayDate(vacatedDate)}
        </p>
      ) : (
        <p className="text-xs font-semibold text-amber-800">Vacate date not recorded</p>
      )}

      <div className="flex flex-wrap gap-2">
        {mergeTarget ? (
          <button
            type="button"
            onClick={onMergeDuplicate}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Merge into {mergeTarget.canonicalName}
          </button>
        ) : null}
        {endedTenancyId ? (
          <button
            type="button"
            onClick={() => setOpen(open === "vacate" ? null : "vacate")}
            className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
          >
            {vacatedDate ? "Edit vacate date" : "Record vacate date"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          Archive
        </button>
      </div>

      {open === "vacate" && endedTenancyId ? (
        <form onSubmit={onRecordVacateDate} className="rounded-xl bg-slate-50 p-3">
          <input type="hidden" name="tenancy_id" value={endedTenancyId} />
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700">
              Move-out date
            </span>
            <input
              type="date"
              name="end_date"
              required
              defaultValue={vacatedDate ?? todayIsoDate()}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save vacate date"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
    </div>
  );
}
