import AdminLayout from "@/components/admin/AdminLayout";
import WaterPanel from "@/components/admin/WaterPanel";
import { requireAdmin } from "@/lib/auth";
import { listVendors, listWaterTankers } from "@/lib/ops";
import { listPaymentAccounts, toPaymentAccountOptions } from "@/lib/payment-accounts";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

export default async function WaterPage() {
  const { supabase } = await requireAdmin();
  const [vendors, tankers, accountsResult] = await Promise.all([
    listVendors(supabase),
    listWaterTankers(supabase),
    listPaymentAccounts(supabase),
  ]);
  const accounts = accountsResult.accounts;

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Water Tankers
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Record tanker deliveries and supplier payment status.
        </p>
      </div>
      <WaterPanel
        vendors={vendors.map((v) => ({ id: v.id, label: v.name }))}
        accounts={toPaymentAccountOptions(accounts)}
        rows={tankers.map((row) => ({
          id: row.id,
          deliveryDate: formatDisplayDate(row.deliveryDate),
          amountLabel: row.amount != null ? formatInr(row.amount) : "—",
          vendorName: row.vendorName ?? "No vendor",
          paymentStatus: row.paymentStatus ?? "—",
          payerLabel: row.payerAccountLabel,
          notes: row.notes,
        }))}
      />
    </AdminLayout>
  );
}
