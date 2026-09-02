"use client";

import type { DuesBreakdown } from "@/lib/dues-breakdown";
import { formatInr } from "@/lib/receipts";

function LineRows({
  lines,
  highlightArrears,
}: {
  lines: DuesBreakdown["lines"];
  highlightArrears?: boolean;
}) {
  return (
    <>
      {lines.map((line) => (
        <tr
          key={`${line.arrearsMonthKey ?? "current"}-${line.key}`}
          className={highlightArrears ? "bg-amber-50/80" : undefined}
        >
          <td className="px-4 py-3 font-medium text-slate-900">
            {line.label}
            {line.isArrears ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Arrears
              </span>
            ) : null}
          </td>
          <td className="px-4 py-3 text-right text-slate-700">
            {formatInr(line.due)}
          </td>
          <td className="px-4 py-3 text-right text-slate-500">
            {formatInr(line.paid)}
          </td>
          <td
            className={`px-4 py-3 text-right font-semibold ${
              line.outstanding > 0 ? "text-amber-800" : "text-slate-900"
            }`}
          >
            {formatInr(line.outstanding)}
          </td>
        </tr>
      ))}
    </>
  );
}

export default function DuesBreakdownTable({
  breakdown,
}: {
  breakdown: DuesBreakdown;
}) {
  const hasCurrentLines = breakdown.lines.length > 0;
  const hasArrears = (breakdown.arrears?.length ?? 0) > 0;

  if (!hasCurrentLines && !hasArrears) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No monthly dues on record for this period.
      </p>
    );
  }

  const grandOutstanding =
    breakdown.grandTotalOutstanding ?? breakdown.totalOutstanding;
  const arrearsTotal = (breakdown.arrears ?? []).reduce(
    (sum, month) => sum + month.totalOutstanding,
    0
  );

  return (
    <div className="space-y-4">
      {hasArrears ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Outstanding from earlier months:</span>{" "}
          {formatInr(arrearsTotal)}. These amounts are included in the total
          below.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Due</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hasArrears
              ? breakdown.arrears!.flatMap((month) => [
                  <tr key={`${month.billingMonthKey}-header`} className="bg-amber-50/40">
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-900"
                    >
                      {month.billingMonthLabel} — arrears
                    </td>
                  </tr>,
                  ...month.lines.map((line) => (
                    <tr
                      key={`${month.billingMonthKey}-${line.key}`}
                      className="bg-amber-50/80"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {line.label}
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Arrears
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatInr(line.due)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatInr(line.paid)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-800">
                        {formatInr(line.outstanding)}
                      </td>
                    </tr>
                  )),
                  <tr
                    key={`${month.billingMonthKey}-subtotal`}
                    className="bg-amber-50/30 text-xs"
                  >
                    <td className="px-4 py-2 font-semibold text-amber-950">
                      Subtotal ({month.billingMonthLabel})
                    </td>
                    <td colSpan={2} />
                    <td className="px-4 py-2 text-right font-bold text-amber-900">
                      {formatInr(month.totalOutstanding)}
                    </td>
                  </tr>,
                ])
              : null}
            {hasCurrentLines ? (
              <>
                {hasArrears ? (
                  <tr className="bg-slate-50">
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600"
                    >
                      Selected billing month
                    </td>
                  </tr>
                ) : null}
                <LineRows lines={breakdown.lines} />
              </>
            ) : null}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-emerald-50/60">
            {hasCurrentLines ? (
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  Month total
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatInr(breakdown.totalDue)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">
                  {formatInr(breakdown.totalPaid)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-800">
                  {formatInr(breakdown.totalOutstanding)}
                </td>
              </tr>
            ) : null}
            {hasArrears ? (
              <tr className="border-t border-emerald-100">
                <td className="px-4 py-3 font-bold text-slate-900">
                  Grand total outstanding
                </td>
                <td colSpan={2} />
                <td className="px-4 py-3 text-right text-lg font-bold text-emerald-800">
                  {formatInr(grandOutstanding)}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
