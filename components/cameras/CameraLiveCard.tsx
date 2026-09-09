"use client";

import { useState, useTransition } from "react";
import { fetchCameraStreamAction } from "@/app/cameras/actions";
import HlsVideoPlayer from "@/components/cameras/HlsVideoPlayer";
import type { Camera, CameraPlayback } from "@/lib/cameras";
import { formatActionError } from "@/lib/format-action-error";

export default function CameraLiveCard({ camera }: { camera: Camera }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [playback, setPlayback] = useState<CameraPlayback | null>(null);

  function loadLive() {
    setError("");
    const formData = new FormData();
    formData.set("camera_id", camera.id);
    startTransition(async () => {
      try {
        const result = await fetchCameraStreamAction(formData);
        if (!result.ok) {
          setPlayback(null);
          setError(result.error);
          return;
        }
        setPlayback(result.playback);
      } catch (err) {
        setPlayback(null);
        setError(formatActionError(err, "Could not load the live view."));
      }
    });
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{camera.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {camera.location || "Common area"}
            {!camera.enabled ? " · disabled" : ""}
            {!camera.tenantVisible ? " · admin only" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={loadLive}
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Loading…" : playback ? "Refresh" : "View live"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {playback?.kind === "hls" ? (
        <div className="mt-4">
          <HlsVideoPlayer src={playback.url} title={camera.name} />
        </div>
      ) : null}

      {playback?.kind === "link" ? (
        <a
          href={playback.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-emerald-700"
        >
          Open live view
        </a>
      ) : null}
    </article>
  );
}