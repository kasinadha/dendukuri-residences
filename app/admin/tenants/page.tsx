import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin } from "@/lib/auth";
import { formatInr } from "@/lib/receipts";
import { listTenantsForAdmin } from "@/lib/tenants";

export default async function TenantsPage() {
  const { supabase } = await requireAdmin();
  const tenants = await listTenantsForAdmin(supabase);
  const activeCount = tenants.filter((t) => t.hasActiveTenancy).length;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Tenants
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Tenant profiles from Supabase with linked flat and rent where a
            tenancy exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
            {tenants.length} tenants
          </span>
          <span className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 ring-1 ring-emerald-100">
            {activeCount} with active tenancy
          </span>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {tenants.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No tenants found. Add tenants in Supabase to see them here.
          </p>
        ) : (
          <>
            <div className="hidden border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.3fr_1.2fr_1fr_0.8fr_0.9fr_0.9fr] lg:gap-4 lg:px-6">
              <span>Name</span>
              <span>Contact</span>
              <span>Flat</span>
              <span>Type</span>
              <span>Rent</span>
              <span>Status</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {tenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="grid gap-2 px-5 py-4 lg:grid-cols-[1.3fr_1.2fr_1fr_0.8fr_0.9fr_0.9fr] lg:items-center lg:gap-4 lg:px-6"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Name
                    </p>
                    <p className="font-semibold text-slate-900">
                      {tenant.fullName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Contact
                    </p>
                    <p className="text-sm text-slate-700">
                      {tenant.phone ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tenant.email ?? "No email"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Flat
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {tenant.flatNumber ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Type
                    </p>
                    <p className="text-sm text-slate-700">
                      {tenant.flatType ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Rent
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {tenant.monthlyRent != null
                        ? formatInr(tenant.monthlyRent)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Status
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        tenant.hasActiveTenancy
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tenant.tenancyStatus ?? "no tenancy"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
