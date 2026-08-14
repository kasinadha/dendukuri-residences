"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantCreateVacate } from "@/app/tenant/actions";

export default function TenantVacateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await tenantCreateVacate(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Vacate request submitted.");
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Request to vacate</h3>
      <p className="mt-1 text-sm text-slate-500">
        Notify the owner that you plan to leave. Status updates appear here after
        review.
      </p>
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
        {pending ? "Submitting…" : "Submit vacate request"}
      </button>
    </form>
  );
}
