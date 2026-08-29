import { formatInr } from "@/lib/receipts";
import type { BuildingRevenueReport } from "@/lib/building-revenue";

type Props = {
  report: BuildingRevenueReport;
  billingMonthLabel: string;
};

export default function BuildingRevenuePanel({
  report,
  billingMonthLabel,
}: Props) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">
          Building & account split
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Rent collected by building wing and by receiving account
          {report.billingMonthKey ? ` for ${billingMonthLabel}` : " (all time)"}.
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            By building
          </h4>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {report.byBuilding.map((row) => (
              <li
                key={row.wing}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="font-semibold text-slate-900">
                  {formatInr(row.collected)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Received into account
          </h4>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {report.byAccount.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">
                No tagged payments yet. Map QR codes under Accounts and record
                where rent was received.
              </li>
            ) : (
              report.byAccount.map((row) => (
                <li
                  key={row.accountId ?? "unassigned"}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {row.accountLabel}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.paymentCount} payment
                      {row.paymentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-700">
                    {formatInr(row.collected)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Expenses by payer
          </h4>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {report.expensesByPayer.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">
                No tagged expenses yet. Select who paid when recording water
                tankers or maintenance.
              </li>
            ) : (
              report.expensesByPayer.map((row) => (
                <li
                  key={row.accountId ?? "unassigned"}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {row.accountLabel}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.expenseCount} expense
                      {row.expenseCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-semibold text-red-700">
                    {formatInr(row.spent)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600 sm:px-6">
        <span className="font-semibold text-slate-900">
          Total collected: {formatInr(report.totalCollected)}
        </span>
        <span className="mx-2">·</span>
        <span className="font-semibold text-slate-900">
          Total expenses tagged: {formatInr(report.totalExpenses)}
        </span>
      </div>
    </section>
  );
}
