import AdminLayout from "@/components/admin/AdminLayout";
import TenantDetailsEditor from "@/components/admin/TenantDetailsEditor";
import TenantLoginActions from "@/components/admin/TenantLoginActions";
import TenantOccupancyActions from "@/components/admin/TenantOccupancyActions";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForAdmin } from "@/lib/flats";
import { formatInr } from "@/lib/receipts";
import { listTenantsForAdmin } from "@/lib/tenants";

export default async function TenantsPage() {
  const { supabase } = await requireAdmin();
  const [tenants, flats] = await Promise.all([
    listTenantsForAdmin(supabase),
    listFlatsForAdmin(supabase),
  ]);
  const activeCount = tenants.filter((t) => t.hasActiveTenancy).length;
  const vacantFlats = flats
    .filter((f) => !f.isOccupied)
    .map((f) => ({
      id: f.id,
      label: `Flat ${f.flatNumber}${f.type !== "—" ? ` · ${f.type}` : ""}`,
    }));

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Tenants
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Tenant profiles with linked flat, rent, and advance/deposit. Contact
            details are freely editable; rent and advance are locked and need
            confirmation to change. Portal logins, transfer, and vacate are
            separate.
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
            <div className="hidden border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1fr_0.95fr_0.6fr_0.55fr_0.65fr_0.85fr_0.6fr_0.9fr_0.85fr_1fr] lg:gap-3 lg:px-6">
              <span>Name</span>
              <span>Contact</span>
              <span>Flat</span>
              <span>Type</span>
              <span>Rent</span>
              <span>Advance</span>
              <span>Status</span>
              <span>Portal login</span>
              <span>Occupancy</span>
              <span>Details</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {tenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="grid gap-2 px-5 py-4 lg:grid-cols-[1fr_0.95fr_0.6fr_0.55fr_0.65fr_0.85fr_0.6fr_0.9fr_0.85fr_1fr] lg:items-start lg:gap-3 lg:px-6"
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
                      Advance
                    </p>
                    {tenant.hasActiveTenancy ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">
                          {tenant.depositAmount != null
                            ? formatInr(tenant.depositAmount)
                            : "—"}{" "}
                          <span className="font-normal text-slate-500">
                            agreed
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Paid{" "}
                          {tenant.depositPaid != null
                            ? formatInr(tenant.depositPaid)
                            : "—"}
                          {tenant.depositPaidDate
                            ? ` · ${tenant.depositPaidDate}`
                            : ""}
                        </p>
                        {tenant.depositAmount != null &&
                        tenant.depositPaid != null &&
                        tenant.depositAmount > tenant.depositPaid ? (
                          <p className="text-xs font-semibold text-amber-800">
                            Balance{" "}
                            {formatInr(
                              tenant.depositAmount - tenant.depositPaid
                            )}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">—</p>
                    )}
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
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Portal login
                    </p>
                    <TenantLoginActions
                      tenantId={tenant.id}
                      fullName={tenant.fullName}
                      phone={tenant.phone}
                      email={tenant.email}
                      hasPortalLogin={tenant.hasPortalLogin}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Occupancy
                    </p>
                    {tenant.hasActiveTenancy && tenant.tenancyId ? (
                      <TenantOccupancyActions
                        tenancyId={tenant.tenancyId}
                        vacantFlats={vacantFlats}
                        currentRent={tenant.monthlyRent}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">
                        {tenant.tenancyStatus ? "No active occupancy" : "—"}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Details
                    </p>
                    <TenantDetailsEditor
                      tenantId={tenant.id}
                      fullName={tenant.fullName}
                      phone={tenant.phone}
                      email={tenant.email}
                      monthlyRent={tenant.monthlyRent}
                      depositAmount={tenant.depositAmount}
                      depositPaid={tenant.depositPaid}
                      depositPaidDate={tenant.depositPaidDate}
                      tenancyId={tenant.tenancyId}
                      hasActiveTenancy={tenant.hasActiveTenancy}
                    />
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
