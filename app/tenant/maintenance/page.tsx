import TenantMaintenanceForm from "@/components/tenant/TenantMaintenanceForm";
import { requireTenant } from "@/lib/auth";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { formatInr } from "@/lib/receipts";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantMaintenancePage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const requests = ctx?.flatId
    ? await listMaintenanceRequests(supabase, { flatId: ctx.flatId, limit: 40 })
    : [];

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">MAINTENANCE</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Repair requests
      </h2>
      <p className="mt-2 text-slate-500">
        Raise issues for flat {ctx?.flatNumber ?? "—"} and track status.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <TenantMaintenanceForm />
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">Your requests</h3>
          </div>
          {requests.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.status} · {row.priority}
                    {row.cost != null ? ` · ${formatInr(row.cost)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
