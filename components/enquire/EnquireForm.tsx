"use client";

import { FormEvent, useState, useTransition } from "react";
import { submitEnquiryAction } from "@/app/enquire/actions";

export default function EnquireForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitEnquiryAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWhatsappUrl(result.whatsappUrl);
    });
  }

  if (whatsappUrl) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 className="text-lg font-bold text-emerald-950">Thanks — we have your answers.</h3>
        <p className="mt-2 text-sm text-emerald-900">
          Continue on WhatsApp so we can share availability and visit slots.
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Continue on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Name</span>
        <input
          name="full_name"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Mobile (WhatsApp)
        </span>
        <input
          name="phone"
          required
          inputMode="tel"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">BHK</span>
        <select
          name="bhk_preference"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="">Select</option>
          <option value="1BHK">1BHK</option>
          <option value="2BHK">2BHK</option>
          <option value="either">Either</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Target move-in month
        </span>
        <input
          name="move_in_month"
          type="month"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Budget range
        </span>
        <input
          name="budget_range"
          placeholder="e.g. 18–22k"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Occupants / family size
        </span>
        <input
          name="occupants"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Parking</span>
        <select
          name="parking_need"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="">Select</option>
          <option value="two_wheeler">Two-wheeler</option>
          <option value="four_wheeler">Four-wheeler</option>
          <option value="both">Both</option>
          <option value="none">None</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          How did you hear about us?
        </span>
        <input
          name="heard_from"
          placeholder="Poster, Google, friend…"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Anything else
        </span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit enquiry"}
      </button>
    </form>
  );
}
