"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantSubmitNameChangeAction } from "@/app/tenant/actions";
import type { TenantChangeRequest } from "@/lib/tenant-change-requests";

export default function TenantNameChangeForm({
  currentName,
  pending,
  latest,
}: {
  currentName: string;
  pending: TenantChangeRequest | null;
  latest: TenantChangeRequest | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await tenantSubmitNameChangeAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Sent to the owner for approval.");
      form.reset();
      router.refresh();
    });
  }

  return (
    <section
      id="name-correction"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="text-lg font-bold text-slate-900">
        Wrong name or other details?
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Name on file:{" "}
        <span className="font-semibold text-slate-800">{currentName}</span>.
        Request a spelling fix, a different name for receipts, or report anything
        that does not match your records. The owner approves it before the portal
        updates.
      </p>

      {pending ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Waiting for approval to change to{" "}
          <span className="font-semibold">{pending.requestedValue}</span>.
        </p>
      ) : null}

      {latest?.status === "rejected" && !pending ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          The owner declined “{latest.requestedValue}”
          {latest.adminNote ? ` — ${latest.adminNote}` : "."}
        </p>
      ) : null}

      {latest?.status === "approved" && !pending ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Name update approved.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Correct name
          </span>
          <input
            name="full_name"
            required
            minLength={2}
            disabled={Boolean(pending) || busy}
            defaultValue={pending?.requestedValue ?? ""}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            What is wrong? (optional)
          </span>
          <input
            name="tenant_note"
            placeholder="Spelling, extra initials, wrong person…"
            disabled={Boolean(pending) || busy}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50"
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={Boolean(pending) || busy}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send request to owner"}
        </button>
      </form>
    </section>
  );
}
