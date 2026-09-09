import { formatInr } from "@/lib/receipts";
import type {
  BuildingRevenueReport,
  DuesCategoryBreakdown,
} from "@/lib/building-revenue";

type Props = {
  report: BuildingRevenueReport;
  billingMonthLabel: string;
};

function DuesBreakdownLine({
  breakdown,
  className = "",
}: {
  breakdown: DuesCategoryBreakdown;
  className?: string;
}) {
  const parts = [
    breakdown.rent > 0
      ? `Rent ${formatInr(breakdown.rent)}`
      : null,
    breakdown.electricity > 0
      ? `Electricity ${formatInr(breakdown.electricity)}`
      : null,
    breakdown.other > 0
      ? `Other charges ${formatInr(breakdown.other)}`
      : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return (
      <p className={`text-xs text-slate-500 ${className}`.trim()}>
        No category split recorded for this period.
      </p>
    );
  }

  return (
    <p className={`text-xs text-slate-600 ${className}`.trim()}>
      {parts.join(" · ")}
    </p>
  );
}

export default function BuildingRevenuePanel({
  report,
  billingMonthLabel,
}: Props) {
  const periodLabel = report.billingMonthKey
    ? billingMonthLabel
    : "all time";

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 shadow-sm">
        <div className="border-b border-violet-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">
            Deposits (overall)
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Agreed, collected, returned, and currently held per building. Uses
            tenancy records plus deposit/advance payments.
          </p>
        </div>
        <ul className="divide-y divide-violet-100">
          {report.depositsByBuilding.map((row) => (
            <li key={row.wing} className="px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {row.tenantCount} tenant{row.tenantCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span>
                    Agreed{" "}
                    <span className="font-semibold text-slate-900">
                      {formatInr(row.agreed)}
                    </span>
                  </span>
                  <span>
                    Collected{" "}
                    <span className="font-semibold text-violet-800">
                      {formatInr(row.collected)}
                    </span>
                  </span>
                  {row.returned > 0 ? (
                    <span>
                      Returned{" "}
                      <span className="font-semibold text-slate-700">
                        {formatInr(row.returned)}
                      </span>
                    </span>
                  ) : null}
                  <span>
                    Held{" "}
                    <span className="font-semibold text-emerald-800">
                      {formatInr(row.held)}
                    </span>
                  </span>
                  {row.outstanding > 0 ? (
                    <span>
                      Pending{" "}
                      <span className="font-semibold text-amber-800">
                        {formatInr(row.outstanding)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              {row.tenants.length > 0 ? (
                <ul className="mt-3 divide-y divide-violet-100/80 rounded-xl border border-violet-100 bg-white/70 text-sm">
                  {row.tenants.map((tenant) => (
                    <li
                      key={tenant.tenancyId}
                      className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-900">
                        Flat {tenant.flatNumber} · {tenant.tenantName}
                      </span>
                      <span className="text-xs text-slate-600 sm:text-sm">
                        Agreed {formatInr(tenant.agreed)} · Collected{" "}
                        {formatInr(tenant.collected)}
                        {tenant.returned > 0
                          ? ` · Returned ${formatInr(tenant.returned)}`
                          : ""}
                        {" · "}Held {formatInr(tenant.held)}
                        {tenant.pending > 0
                          ? ` · Pending ${formatInr(tenant.pending)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="border-t border-violet-100 px-5 py-3 text-sm text-slate-700 sm:px-6">
          <span className="font-semibold text-slate-900">
            Total deposits collected: {formatInr(report.totalDepositsPaid)}
          </span>
          {report.totalDepositsReturned > 0 ? (
            <>
              <span className="mx-2">·</span>
              <span>Returned {formatInr(report.totalDepositsReturned)}</span>
            </>
          ) : null}
          <span className="mx-2">·</span>
          <span>Held {formatInr(report.totalDepositsHeld)}</span>
          {report.totalDepositsAgreed > report.totalDepositsPaid ? (
            <>
              <span className="mx-2">·</span>
              <span>
                {formatInr(report.totalDepositsAgreed - report.totalDepositsPaid)}{" "}
                still pending against agreed amounts
              </span>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">
            Monthly dues & expenses
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Rent and monthly charges only for {periodLabel}. Deposits received
            this month are shown separately and are not included in net income.
            The rent / electricity / other-charges line is a split of dues
            collected — other charges are parking, washer, maintenance, and
            fines from tenants, not building expenses.
          </p>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              By building (C / D)
            </h4>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {report.byBuilding.map((row) => (
                <li key={row.wing} className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">
                        {row.duesPaymentCount} dues payment
                        {row.duesPaymentCount === 1 ? "" : "s"}
                        {row.depositPaymentCount > 0
                          ? ` · ${row.depositPaymentCount} deposit`
                          : ""}
                        {row.expenseCount > 0
                          ? ` · ${row.expenseCount} expense${row.expenseCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        row.net >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      Net {formatInr(row.net)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Dues collected{" "}
                      <span className="font-semibold text-slate-900">
                        {formatInr(row.duesCollected)}
                      </span>
                    </span>
                    {row.depositsCollected > 0 ? (
                      <span>
                        Deposits collected{" "}
                        <span className="font-semibold text-violet-800">
                          {formatInr(row.depositsCollected)}
                        </span>
                      </span>
                    ) : null}
                    <span>
                      Expenses{" "}
                      <span className="font-semibold text-red-700">
                        {formatInr(row.spent)}
                      </span>
                    </span>
                  </div>
                  <DuesBreakdownLine breakdown={row.duesBreakdown} />
                </li>
              ))}
            </ul>
            {report.sharedBuildingExpenses.spent > 0 ? (
              <p className="mt-2 text-xs text-slate-600">
                Shared / both buildings expenses:{" "}
                <span className="font-semibold text-red-700">
                  {formatInr(report.sharedBuildingExpenses.spent)}
                </span>{" "}
                ({report.sharedBuildingExpenses.expenseCount} item
                {report.sharedBuildingExpenses.expenseCount === 1 ? "" : "s"})
              </p>
            ) : null}
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Received into account
            </h4>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {report.byAccount.length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">
                  No tagged payments yet. Map QR codes under Accounts and record
                  where payments were received.
                </li>
              ) : (
                report.byAccount.map((row) => (
                  <li key={row.accountId ?? "unassigned"} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {row.accountLabel}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.paymentCount} payment
                          {row.paymentCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-emerald-700">
                          {formatInr(row.duesCollected)}
                        </p>
                        <p className="text-xs text-slate-500">Dues collected</p>
                      </div>
                    </div>
                    {row.depositsCollected > 0 ? (
                      <p className="mt-1 text-right text-xs text-violet-800">
                        Deposits collected {formatInr(row.depositsCollected)}
                      </p>
                    ) : null}
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
                  No tagged expenses yet. Record building, flat, and who paid for
                  water tankers, maintenance, or other expenses.
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
          <div className="flex flex-col gap-2">
            <div>
              <span className="font-semibold text-slate-900">
                Dues collected ({periodLabel}):{" "}
                {formatInr(report.totalDuesCollected)}
              </span>
              <span className="mx-2">·</span>
              <span className="font-semibold text-violet-900">
                Deposits collected ({periodLabel}):{" "}
                {formatInr(report.totalDepositsCollected)}
              </span>
              <span className="mx-2">·</span>
              <span className="font-semibold text-slate-900">
                Expenses: {formatInr(report.totalExpenses)}
              </span>
            </div>
            <DuesBreakdownLine
              breakdown={report.totalDuesBreakdown}
              className="text-sm"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
