"use client";

import type { DuesBreakdown } from "@/lib/dues-breakdown";
import { formatInr } from "@/lib/receipts";

export default function DuesBreakdownTable({
  breakdown,
}: {
  breakdown: DuesBreakdown;
}) {
  if (breakdown.lines.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No monthly dues on record for this period.
      </p>
    );
  }

  return (
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
              <td className="px-4 py-3 font-medium text-slate-900">{line.label}</td>
              <td className="px-4 py-3 text-right text-slate-700">
                {formatInr(line.due)}
              </td>
              <td className="px-4 py-3 text-right text-slate-500">
                {formatInr(line.paid)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatInr(line.outstanding)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-emerald-50/60">
          <tr>
            <td className="px-4 py-3 font-semibold text-slate-900">Total</td>
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
        </tfoot>
      </table>
    </div>
  );
}
