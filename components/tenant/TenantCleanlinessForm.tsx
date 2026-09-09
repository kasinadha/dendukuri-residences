"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantCreateMaintenance } from "@/app/tenant/actions";
import { formatActionError } from "@/lib/format-action-error";
import {
  isVideoMime,
  MAINTENANCE_MEDIA_ACCEPT,
  MAX_MAINTENANCE_MEDIA,
  MAX_MAINTENANCE_VIDEOS,
  mimeOfFile,
} from "@/lib/storage-uploads";

export default function TenantCleanlinessForm() {
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
      try {
        const result = await tenantCreateMaintenance(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Cleanliness report submitted with media.");
        form.reset();
        router.refresh();
      } catch (err) {
        setError(formatActionError(err, "Could not submit the report."));
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">
        Report a cleanliness issue
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Use this when common areas or the flat are not being cleaned. A photo
        or short video is required so the owner can follow up.
      </p>
      <input type="hidden" name="category" value="cleanliness" />
      <input type="hidden" name="priority" value="high" />
      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Where / what
          </span>
          <input
            name="title"
            required
            placeholder="e.g. Staircase, parking, corridor"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Details
          </span>
          <textarea
            name="description"
            rows={3}
            placeholder="What is not being handled, and since when."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Photos or videos
          </span>
          <input
            name="photos"
            type="file"
            required
            multiple
            accept={MAINTENANCE_MEDIA_ACCEPT}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Up to {MAX_MAINTENANCE_MEDIA} files. Photos 5 MB each. Videos MP4 /
            MOV / WebM, 25 MB each, max {MAX_MAINTENANCE_VIDEOS}.
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
        className="mt-6 rounded-xl bg-amber-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit with photos or video"}
      </button>
    </form>
  );
}
