import AdminLayout from "@/components/admin/AdminLayout";
import MaintenancePanel from "@/components/admin/MaintenancePanel";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForSelect } from "@/lib/electricity";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { listPaymentAccounts, toPaymentAccountOptions } from "@/lib/payment-accounts";
import { formatInr } from "@/lib/receipts";

export default async function MaintenancePage() {
  const { supabase } = await requireAdmin();
  const [flats, requests, accounts] = await Promise.all([
    listFlatsForSelect(supabase),
    listMaintenanceRequests(supabase),
    listPaymentAccounts(supabase),
  ]);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Maintenance
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Create repair requests and update status as work progresses.
        </p>
      </div>

      <MaintenancePanel
        flats={flats}
        accounts={toPaymentAccountOptions(accounts)}
        requests={requests.map((row) => ({
          id: row.id,
          flatNumber: row.flatNumber,
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          costLabel: row.cost != null ? formatInr(row.cost) : "—",
          category: row.category,
          payerLabel: row.payerAccountLabel,
        }))}
      />
    </AdminLayout>
  );
}
