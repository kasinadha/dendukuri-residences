"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantCreateVacate } from "@/app/tenant/actions";

type RequestKind = "vacate" | "transfer";

export default function TenantVacateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [kind, setKind] = useState<RequestKind>("vacate");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    formData.set("request_type", kind);
    startTransition(async () => {
      const result = await tenantCreateVacate(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        kind === "transfer"
          ? "Transfer request submitted. The owner will assign a vacant flat."
          : "Vacate request submitted."
      );
      event.currentTarget.reset();
      setKind("vacate");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Move request</h3>
      <p className="mt-1 text-sm text-slate-500">
        Ask to leave the property, or to shift to another flat here. The owner
        reviews and updates occupancy from the admin portal.
      </p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-semibold text-slate-700">
          What do you need?
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKind("vacate")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              kind === "vacate"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Move out
          </button>
          <button
            type="button"
            onClick={() => setKind("transfer")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              kind === "transfer"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Transfer within
          </button>
        </div>
      </fieldset>

      {kind === "transfer" ? (
        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Preferred vacant flat (optional)
          </span>
          <input
            name="preferred_flat_number"
            placeholder="e.g. D102"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
      ) : null}

      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Reason (optional)
        </span>
        <textarea
          name="reason"
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
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
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
