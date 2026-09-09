"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantCreateMaintenance } from "@/app/tenant/actions";
import {
  isVideoMime,
  MAINTENANCE_MEDIA_ACCEPT,
  MAX_MAINTENANCE_MEDIA,
  MAX_MAINTENANCE_VIDEOS,
  mimeOfFile,
} from "@/lib/storage-uploads";

export default function TenantMaintenanceForm() {
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
    const files = formData
      .getAll("photos")
      .filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > MAX_MAINTENANCE_MEDIA) {
      setError(`Upload up to ${MAX_MAINTENANCE_MEDIA} photos or videos.`);
      return;
    }
    const videoCount = files.filter((file) => isVideoMime(mimeOfFile(file))).length;
    if (videoCount > MAX_MAINTENANCE_VIDEOS) {
      setError(`Upload up to ${MAX_MAINTENANCE_VIDEOS} videos.`);
      return;
    }
    startTransition(async () => {
      const result = await tenantCreateMaintenance(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Request submitted.");
      form.reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Raise a request</h3>
      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Title
          </span>
          <input
            name="title"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Priority
          </span>
          <select
            name="priority"
            defaultValue="normal"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Category
          </span>
          <input
            name="category"
            placeholder="plumbing / electrical"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Description
          </span>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Photos or videos (optional)
          </span>
          <input
            name="photos"
            type="file"
            multiple
            accept={MAINTENANCE_MEDIA_ACCEPT}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Up to {MAX_MAINTENANCE_MEDIA} files. Photos 5 MB. Videos 25 MB, max{" "}
            {MAX_MAINTENANCE_VIDEOS}.
          </span>
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
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
