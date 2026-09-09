import CameraLiveCard from "@/components/cameras/CameraLiveCard";
import { requireTenant } from "@/lib/auth";
import { listCameras } from "@/lib/cameras";

export default async function TenantCamerasPage() {
  const { supabase } = await requireTenant();
  const cameras = await listCameras(supabase, { tenantOnly: true });

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">CAMERAS</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Common-area cameras
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Live view of the gate, parking, and other shared spaces. These feeds are
        for residents only — not the public website.
      </p>

      {cameras.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No cameras are shared yet. Ask the owner to add common-area cameras
          under Admin → Cameras.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {cameras.map((camera) => (
            <CameraLiveCard key={camera.id} camera={camera} />
          ))}
        </div>
      )}
    </div>
  );
}