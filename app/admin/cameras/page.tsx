import AdminLayout from "@/components/admin/AdminLayout";
import CamerasAdminPanel from "@/components/admin/CamerasAdminPanel";
import { requireAdmin } from "@/lib/auth";
import { listCameras } from "@/lib/cameras";
import { hikConnectConfigured } from "@/lib/hikconnect";

export default async function AdminCamerasPage() {
  const { supabase } = await requireAdmin();
  const cameras = await listCameras(supabase);
  const apiReady = hikConnectConfigured();

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Cameras
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Live view of common-area Hik-Connect cameras for you and tenants.
          Do not add cameras that look into flats.
        </p>
        {!apiReady ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Hik-Connect API keys are not set. You can still add HLS or guest
            share URLs. For in-page live view from serial numbers, add{" "}
            <code>HIKCONNECT_APP_KEY</code> and{" "}
            <code>HIKCONNECT_APP_SECRET</code>, then run{" "}
            <code>supabase/migrations/20260908_cameras.sql</code>.
          </p>
        ) : null}
      </div>
      <CamerasAdminPanel cameras={cameras} />
    </AdminLayout>
  );
}