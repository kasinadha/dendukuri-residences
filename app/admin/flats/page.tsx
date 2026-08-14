import AdminLayout from "@/components/admin/AdminLayout";
import AssignTenancyForm from "@/components/admin/AssignTenancyForm";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForAdmin } from "@/lib/flats";
import { formatInr } from "@/lib/receipts";
import { D201_FLAT_NUMBER } from "@/lib/tenancies";

function statusClasses(occupied: boolean) {
  if (occupied) return "bg-emerald-50 text-emerald-800";
  return "bg-amber-50 text-amber-800";
}

export default async function FlatsPage() {
  const { supabase } = await requireAdmin();
  const flats = await listFlatsForAdmin(supabase);

  const occupied = flats.filter((f) => f.isOccupied).length;
  const vacant = flats.length - occupied;
  const d201Present = flats.some(
    (f) => f.flatNumber.toUpperCase() === D201_FLAT_NUMBER
  );

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
            Flats
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Occupancy from active tenancies — vacant or occupied — with rent and
            deposit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
            {flats.length} total
          </span>
          <span className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 ring-1 ring-emerald-100">
            {occupied} occupied
          </span>
          <span className="rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-800 ring-1 ring-amber-100">
            {vacant} vacant
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AssignTenancyForm
          vacantFlats={vacantFlats}
          d201Present={d201Present}
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-slate-900">Inventory</h3>
            <p className="mt-1 text-sm text-slate-500">
              Flat number, occupancy, rent, and linked tenant.
            </p>
          </div>

          {flats.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No flats yet. Seed D201 or assign a new flat tenancy to start.
            </p>
          ) : (
            <>
              <div className="hidden border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_1.1fr] lg:gap-3 lg:px-6">
                <span>Flat</span>
                <span>Occupancy</span>
                <span>Rent</span>
                <span>Deposit</span>
                <span>Source</span>
                <span>Tenant</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {flats.map((flat) => (
                  <li
                    key={flat.id}
                    className="grid gap-2 px-5 py-4 lg:grid-cols-[0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_1.1fr] lg:items-center lg:gap-3 lg:px-6"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Flat
                      </p>
                      <p className="font-semibold text-slate-900">
                        {flat.flatNumber}
                      </p>
                      <p className="text-xs text-slate-500">{flat.type}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Occupancy
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(
                          flat.isOccupied
                        )}`}
                      >
                        {flat.occupancy}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Rent
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {flat.rent != null ? formatInr(flat.rent) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Deposit
                      </p>
                      <p className="text-sm text-slate-700">
                        {flat.deposit != null ? formatInr(flat.deposit) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Source
                      </p>
                      <p className="text-sm text-slate-700">
                        {flat.source ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                        Tenant
                      </p>
                      <p className="text-sm text-slate-600">
                        {flat.tenantName ?? "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
