import AdminLayout from "@/components/admin/AdminLayout";
import BuildingRevenuePanel from "@/components/admin/BuildingRevenuePanel";
import VacateAdminList from "@/components/admin/VacateAdminList";
import { requireAdmin } from "@/lib/auth";
import { getBuildingRevenueReport } from "@/lib/building-revenue";
import { listFlatsForAdmin } from "@/lib/flats";
import { getMonthlyDuesSummary } from "@/lib/monthly-dues";
import { listVacateRequests } from "@/lib/ops";
import { currentBillingMonthKey } from "@/lib/rent-upi";
import { formatBillingMonthLabel, formatInr, listReceiptViews } from "@/lib/receipts";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const month =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : currentBillingMonthKey();

  const [receipts, vacates, flats, revenueReport, duesMonth] = await Promise.all([
    listReceiptViews(supabase, { limit: 12 }),
    listVacateRequests(supabase),
    listFlatsForAdmin(supabase),
    getBuildingRevenueReport(supabase, { billingMonth: month }),
    getMonthlyDuesSummary(supabase, month),
  ]);

  const collected = receipts.reduce((sum, r) => sum + r.rentAmount, 0);
  const vacantFlats = flats
    .filter((f) => !f.isOccupied)
    .map((f) => ({
      id: f.id,
      label: `Flat ${f.flatNumber}${f.type !== "—" ? ` · ${f.type}` : ""}`,
    }));

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Reports
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Building C/D revenue share, account splits, move-out requests, and
          recent collections.
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue month
            </span>
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>
      </div>

      <BuildingRevenuePanel
        report={revenueReport}
        billingMonthLabel={formatBillingMonthLabel(month)}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Recent receipts total</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatInr(collected)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Across last {receipts.length} receipts
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Move requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {vacates.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {vacates.filter((v) => v.status === "pending").length} pending
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Collection rate · {formatBillingMonthLabel(month)}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {duesMonth.collectionRatePercent != null
              ? `${duesMonth.collectionRatePercent}%`
              : "—"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {formatInr(duesMonth.totalCollected)} of{" "}
            {formatInr(duesMonth.totalExpected)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Longest delay</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {duesMonth.delayedDaysMax > 0
              ? `${duesMonth.delayedDaysMax} days`
              : "On time"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {duesMonth.overdueTenants} overdue after the 5th
          </p>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">
            Move-out and transfer requests
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Approve notice, then complete to update occupancy. Completing a
            transfer assigns the tenant to a vacant flat.
          </p>
        </div>
        <VacateAdminList
          vacantFlats={vacantFlats}
          rows={vacates.map((row) => ({
            id: row.id,
            tenantName: row.tenantName ?? "—",
            flatNumber: row.flatNumber ?? "—",
            status: row.status,
            requestType: row.requestType,
            reason: row.reason,
            preferredFlatNumber: row.preferredFlatNumber,
          }))}
        />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Recent receipts</h3>
        </div>
        {receipts.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No receipts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <li
                key={receipt.receiptId}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {receipt.receiptNumber}
                  </p>
                  <p className="text-sm text-slate-500">
                    Flat {receipt.flatNumber} · {receipt.tenantName} ·{" "}
                    {receipt.billingMonth}
                  </p>
                </div>
                <p className="font-semibold text-slate-900">
                  {formatInr(receipt.rentAmount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
