import ElectricityPaymentBadge from "@/components/electricity/ElectricityPaymentBadge";
import { requireTenant } from "@/lib/auth";
import { listElectricityReadings } from "@/lib/electricity";
import { enrichElectricityReadingsWithPaymentStatus } from "@/lib/electricity-dues";
import { formatDisplayDate, formatInr } from "@/lib/receipts";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantElectricityPage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const readings = ctx?.flatId
    ? await listElectricityReadings(supabase, { flatId: ctx.flatId, limit: 40 })
    : [];
  const readingsWithStatus =
    ctx?.flatId && ctx.tenancyId
      ? await enrichElectricityReadingsWithPaymentStatus(supabase, readings, {
          tenancyId: ctx.tenancyId,
          flatId: ctx.flatId,
        })
      : readings.map((row) => ({ ...row, paymentStatus: null }));

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">ELECTRICITY</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Meter readings
      </h2>
      <p className="mt-2 text-slate-500">
        Readings for flat {ctx?.flatNumber ?? "—"}. Payment status is shown per
        billing month.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {readingsWithStatus.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No readings available yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {readingsWithStatus.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {formatDisplayDate(row.readingDate)}
                    {row.billingMonth ? ` · ${row.billingMonth}` : ""}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.units} flat units
                    {row.commonShareUnits != null
                      ? ` + ${row.commonShareUnits.toFixed(2)} common`
                      : ""}
                    {" · "}
                    {row.previousReading} → {row.currentReading}
                  </p>
                  {row.energyCharge != null ? (
                    <p className="text-xs text-slate-500">
                      Energy {formatInr(row.energyCharge)}
                      {row.basicCharge != null
                        ? ` · basic ${formatInr(row.basicCharge)}`
                        : ""}
                      {row.serviceChargeAmount != null
                        ? ` · service ${formatInr(row.serviceChargeAmount)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="font-semibold text-slate-900">
                    {row.billAmount != null ? formatInr(row.billAmount) : "—"}
                  </p>
                  {row.paymentStatus ? (
                    <ElectricityPaymentBadge status={row.paymentStatus} compact />
                  ) : (
                    <p className="text-xs capitalize text-slate-500">
                      {row.status}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
