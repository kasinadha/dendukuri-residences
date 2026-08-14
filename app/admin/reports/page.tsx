import AdminLayout from "@/components/admin/AdminLayout";
import VacateAdminList from "@/components/admin/VacateAdminList";
import { requireAdmin } from "@/lib/auth";
import { listVacateRequests } from "@/lib/ops";
import { formatInr, listReceiptViews } from "@/lib/receipts";

export default async function ReportsPage() {
  const { supabase } = await requireAdmin();
  const [receipts, vacates] = await Promise.all([
    listReceiptViews(supabase, { limit: 12 }),
    listVacateRequests(supabase),
  ]);

  const collected = receipts.reduce((sum, r) => sum + r.rentAmount, 0);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Reports
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Recent collections and vacate request status.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
          <p className="text-sm text-slate-500">Vacate requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {vacates.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {vacates.filter((v) => v.status === "pending").length} pending
          </p>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Vacate requests</h3>
        </div>
        <VacateAdminList
          rows={vacates.map((row) => ({
            id: row.id,
            tenantName: row.tenantName ?? "—",
            flatNumber: row.flatNumber ?? "—",
            status: row.status,
            reason: row.reason,
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
