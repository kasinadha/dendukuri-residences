"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCameraAction,
  deleteCameraAction,
  updateCameraAction,
} from "@/app/cameras/actions";
import CameraLiveCard from "@/components/cameras/CameraLiveCard";
import type { Camera } from "@/lib/cameras";
import { formatActionError } from "@/lib/format-action-error";

function CameraFields({ camera }: { camera?: Camera }) {
  return (
    <>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Name
        </span>
        <input
          name="name"
          required
          defaultValue={camera?.name}
          placeholder="Main gate"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Location
        </span>
        <input
          name="location"
          defaultValue={camera?.location ?? ""}
          placeholder="Gate / parking / lobby"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Stream type
        </span>
        <select
          name="stream_mode"
          defaultValue={camera?.streamMode ?? "hikconnect"}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="hikconnect">Hik-Connect (serial)</option>
          <option value="hls">HLS URL</option>
          <option value="link">Share / guest link</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Device serial
        </span>
        <input
          name="device_serial"
          defaultValue={camera?.deviceSerial ?? ""}
          placeholder="From Hik-Connect device info"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Channel
        </span>
        <input
          name="channel_no"
          type="number"
          min={1}
          defaultValue={camera?.channelNo ?? 1}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          HLS URL (optional)
        </span>
        <input
          name="hls_url"
          defaultValue={camera?.hlsUrl ?? ""}
          placeholder="https://…"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Hik-Connect share URL (fallback)
        </span>
        <input
          name="share_url"
          defaultValue={camera?.shareUrl ?? ""}
          placeholder="Guest share link from Hik-Connect"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          name="tenant_visible"
          value="1"
          defaultChecked={camera?.tenantVisible ?? true}
        />
        Visible to tenants
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          name="enabled"
          value="1"
          defaultChecked={camera?.enabled ?? true}
        />
        Enabled
      </label>
    </>
  );
}

export default function CamerasAdminPanel({ cameras }: { cameras: Camera[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!formData.get("enabled")) formData.set("enabled", "0");
    if (!formData.get("tenant_visible")) formData.set("tenant_visible", "0");
    startTransition(async () => {
      try {
        const result = await createCameraAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Camera saved.");
        form.reset();
        router.refresh();
      } catch (err) {
        setError(formatActionError(err, "Could not save the camera."));
      }
    });
  }

  function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!formData.get("enabled")) formData.set("enabled", "0");
    if (!formData.get("tenant_visible")) formData.set("tenant_visible", "0");
    startTransition(async () => {
      try {
        const result = await updateCameraAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Camera updated.");
        setEditingId(null);
        router.refresh();
      } catch (err) {
        setError(formatActionError(err, "Could not update the camera."));
      }
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Remove this camera from the portal?")) return;
    setError("");
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      const result = await deleteCameraAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Add camera</h3>
        <p className="mt-1 text-sm text-slate-500">
          Common areas only. Use Hik-Connect serial + API keys, or paste an HLS
          / guest share URL.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <CameraFields />
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
          {pending ? "Saving…" : "Save camera"}
        </button>
      </form>

      <section>
        <h3 className="text-lg font-bold text-slate-900">Live view</h3>
        <p className="mt-1 text-sm text-slate-500">
          Same feeds tenants see, plus any admin-only cameras.
        </p>
        {cameras.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No cameras yet. Add the gate or parking camera above.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {cameras.map((camera) => (
              <div key={camera.id} className="space-y-3">
                <CameraLiveCard camera={camera} />
                {editingId === camera.id ? (
                  <form
                    onSubmit={onUpdate}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <input type="hidden" name="id" value={camera.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CameraFields camera={camera} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-3 px-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(camera.id)}
                      className="text-sm font-semibold text-emerald-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(camera.id)}
                      className="text-sm font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}