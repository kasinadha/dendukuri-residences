"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVendorAction } from "@/app/admin/ops-actions";

type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  notes: string | null;
  isActive: boolean;
};

export default function VendorsPanel({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createVendorAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Vendor added.");
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Add vendor</h3>
        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Name
            </span>
            <input
              name="name"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Phone
            </span>
            <input
              name="phone"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </span>
            <input
              name="category"
              placeholder="plumber / electrician"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Notes
            </span>
            <textarea
              name="notes"
              rows={2}
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
          disabled={pending}
          className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add vendor"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Vendors</h3>
        </div>
        {vendors.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No vendors yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {vendors.map((vendor) => (
              <li key={vendor.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900">{vendor.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {vendor.phone ?? "No phone"}
                  {vendor.category ? ` · ${vendor.category}` : ""}
                  {vendor.isActive ? "" : " · inactive"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
