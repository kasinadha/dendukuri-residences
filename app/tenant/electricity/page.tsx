import { requireTenant } from "@/lib/auth";
import { listElectricityReadings } from "@/lib/electricity";
import { formatDisplayDate, formatInr } from "@/lib/receipts";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantElectricityPage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const readings = ctx?.flatId
    ? await listElectricityReadings(supabase, { flatId: ctx.flatId, limit: 40 })
    : [];

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">ELECTRICITY</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Meter readings
      </h2>
      <p className="mt-2 text-slate-500">
        Readings for flat {ctx?.flatNumber ?? "—"}.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {readings.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No readings available yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {readings.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {formatDisplayDate(row.readingDate)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.units} units · {row.previousReading} → {row.currentReading}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-900">
                    {row.billAmount != null ? formatInr(row.billAmount) : "—"}
                  </p>
                  <p className="text-xs capitalize text-slate-500">{row.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
