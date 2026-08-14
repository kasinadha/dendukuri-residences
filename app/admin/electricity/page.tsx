import AdminLayout from "@/components/admin/AdminLayout";
import ElectricityForm from "@/components/admin/ElectricityForm";
import { requireAdmin } from "@/lib/auth";
import {
  listElectricityReadings,
  listFlatsForSelect,
} from "@/lib/electricity";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

export default async function ElectricityPage() {
  const { supabase } = await requireAdmin();
  const [flats, readings] = await Promise.all([
    listFlatsForSelect(supabase),
    listElectricityReadings(supabase),
  ]);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Electricity
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Meter readings, computed units, and bill amounts per flat.
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ElectricityForm flats={flats} />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-slate-900">Recent readings</h3>
          </div>
          {readings.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No readings yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {readings.map((row) => (
                <li key={row.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Flat {row.flatNumber}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDisplayDate(row.readingDate)} · {row.units} units
                        · {row.previousReading} → {row.currentReading}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-slate-900">
                        {row.billAmount != null ? formatInr(row.billAmount) : "—"}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        {row.status}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
