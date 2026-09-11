"use client";

import type { DuesBreakdown } from "@/lib/dues-breakdown";
import { formatInr } from "@/lib/receipts";

export default function DuesBreakdownTable({
  breakdown,
}: {
  breakdown: DuesBreakdown;
}) {
  const hasLines = breakdown.lines.length > 0;
  const priorArrears = breakdown.priorMonthArrearsTotal ?? 0;

  if (!hasLines) {
    return (
      <div className="space-y-3">
        {breakdown.infoMessage ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {breakdown.infoMessage}
          </p>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No outstanding dues for this period.
          </p>
        )}
      </div>
    );
  }

  const grandOutstanding =
    breakdown.grandTotalOutstanding ?? breakdown.totalOutstanding;

  return (
    <div className="space-y-4">
      {priorArrears > 0 && breakdown.priorMonthLabel ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">
            Includes {formatInr(priorArrears)} outstanding from{" "}
            {breakdown.priorMonthLabel}
          </span>
          , rolled into the categories below.
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
            {breakdown.lines.map((line) => (
              <tr key={line.key}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {line.label}
                  {line.arrearsOutstanding != null &&
                  line.arrearsOutstanding > 0 &&
                  line.arrearsMonthLabel ? (
                    <span className="mt-1 block text-xs font-normal text-amber-800">
                      incl. {formatInr(line.arrearsOutstanding)} from{" "}
                      {line.arrearsMonthLabel}
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
          </tbody>
          <tfoot className="border-t border-slate-200 bg-emerald-50/60">
            <tr>
              <td className="px-4 py-3 font-bold text-slate-900">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatInr(breakdown.totalDue)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-700">
                {formatInr(breakdown.totalPaid)}
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-emerald-800">
                {formatInr(grandOutstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
