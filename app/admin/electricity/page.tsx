import AdminLayout from "@/components/admin/AdminLayout";
import ElectricityBillingPanel from "@/components/admin/ElectricityBillingPanel";
import ElectricityForm from "@/components/admin/ElectricityForm";
import ElectricityPaymentBadge from "@/components/electricity/ElectricityPaymentBadge";
import { requireAdmin } from "@/lib/auth";
import {
  getLastBuildingMeterReading,
  listElectricityBillingRuns,
  listElectricityReadings,
  listFlatsForSelect,
  listOccupiedFlatsForBilling,
} from "@/lib/electricity";
import {
  buildTenancyByFlatNumberMap,
  getElectricityPaymentStatusByFlat,
  readingBillingMonthKey,
} from "@/lib/electricity-dues";
import { buildingWingLabel } from "@/lib/building-wing";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

export default async function ElectricityPage() {
  const { supabase } = await requireAdmin();
  const [flats, occupiedFlats, readings, billingRuns, lastBuildingC, lastBuildingD, tenancyByFlat] =
    await Promise.all([
      listFlatsForSelect(supabase),
      listOccupiedFlatsForBilling(supabase),
      listElectricityReadings(supabase),
      listElectricityBillingRuns(supabase),
      getLastBuildingMeterReading(supabase, "C"),
      getLastBuildingMeterReading(supabase, "D"),
      buildTenancyByFlatNumberMap(supabase),
    ]);

  const readingsWithStatus = await Promise.all(
    readings.map(async (row) => {
      const billingMonthKey = readingBillingMonthKey(row);
      const paymentStatus =
        billingMonthKey && row.flatNumber !== "—"
          ? await getElectricityPaymentStatusByFlat(supabase, {
              flatNumber: row.flatNumber,
              billingMonthKey,
              tenancyByFlat,
            })
          : null;
      return { row, paymentStatus };
    })
  );

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Electricity
        </h2>
        <p className="mt-2 max-w-3xl text-slate-500">
          Enter the <strong>Building C</strong> or <strong>Building D</strong> main
          meter readings separately, plus each flat&apos;s cumulative meter. Flats
          are picked for the billing month you select (including mid-month move-ins
          and vacated units). Common area for that wing = building usage − sum of
          flat usage in the same wing, shared only among included flats in that
          wing.
        </p>
      </div>

      <div className="mt-8">
        <ElectricityBillingPanel
          occupiedFlats={occupiedFlats}
          lastBuildingReadings={{ C: lastBuildingC, D: lastBuildingD }}
        />
      </div>

      {billingRuns.length > 0 ? (
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-slate-900">Billing runs</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {billingRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {buildingWingLabel(run.buildingWing)} · {run.billingMonth} ·{" "}
                    {formatDisplayDate(run.readingDate)}
                  </p>
                  <p className="text-sm text-slate-500">
                    Building {run.buildingUnits} units · common{" "}
                    {run.commonAreaUnits.toFixed(2)} · {run.occupiedFlatsCount}{" "}
                    flats · ₹{run.ratePerUnit}/unit
                  </p>
                </div>
                <p className="font-semibold text-slate-900">
                  {formatInr(run.totalBilled)} billed
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
              {readingsWithStatus.map(({ row, paymentStatus }) => (
                <li key={row.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Flat {row.flatNumber}
                        {row.billingMonth ? ` · ${row.billingMonth}` : ""}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDisplayDate(row.readingDate)} · {row.units} flat
                        units
                        {row.commonShareUnits != null
                          ? ` + ${row.commonShareUnits.toFixed(2)} common`
                          : ""}
                        · {row.previousReading} → {row.currentReading}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <p className="font-semibold text-slate-900">
                        {row.billAmount != null ? formatInr(row.billAmount) : "—"}
                      </p>
                      {paymentStatus ? (
                        <ElectricityPaymentBadge status={paymentStatus} />
                      ) : (
                        <p className="text-xs capitalize text-slate-500">
                          {row.status}
                        </p>
                      )}
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
