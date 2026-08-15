import AdminLayout from "@/components/admin/AdminLayout";
import AssignTenancyForm from "@/components/admin/AssignTenancyForm";
import FlatEditorForm from "@/components/admin/FlatEditorForm";
import FlatsInventoryPanel from "@/components/admin/FlatsInventoryPanel";
import ImportRentalCsvPanel from "@/components/admin/ImportRentalCsvPanel";
import TenancyReviewPanel from "@/components/admin/TenancyReviewPanel";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForAdmin } from "@/lib/flats";
import { ensureDendukuriProperty } from "@/lib/property";
import { D201_FLAT_NUMBER } from "@/lib/tenancies";
import { listTenanciesForReview } from "@/lib/tenancy-review";

export default async function FlatsPage() {
  const { supabase } = await requireAdmin();
  const property = await ensureDendukuriProperty(supabase);
  const [flats, tenancies] = await Promise.all([
    listFlatsForAdmin(supabase),
    listTenanciesForReview(supabase),
  ]);

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

  const propertyReady = property.mode === "properties" && Boolean(property.id);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Flats
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Real inventory for {property.name}. Import from the master sheet,
            then review and edit anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-900 ring-1 ring-emerald-100">
            {property.name}
            {propertyReady ? " · property linked" : " · run migration"}
          </span>
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
        <div className="space-y-6">
          <ImportRentalCsvPanel propertyReady={propertyReady} />
          <FlatEditorForm />
          <AssignTenancyForm
            vacantFlats={vacantFlats}
            d201Present={d201Present}
          />
        </div>
        <div className="space-y-6">
          <FlatsInventoryPanel flats={flats} />
          <TenancyReviewPanel items={tenancies} />
        </div>
      </div>
    </AdminLayout>
  );
}
