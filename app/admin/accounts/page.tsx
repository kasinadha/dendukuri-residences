import AdminLayout from "@/components/admin/AdminLayout";
import BuildingRevenuePanel from "@/components/admin/BuildingRevenuePanel";
import PaymentAccountsPanel from "@/components/admin/PaymentAccountsPanel";
import { requireAdmin } from "@/lib/auth";
import { getBuildingRevenueReport } from "@/lib/building-revenue";
import { listPaymentAccounts } from "@/lib/payment-accounts";
import { currentBillingMonthKey } from "@/lib/rent-upi";
import { formatBillingMonthLabel } from "@/lib/receipts";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountsPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const month =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : currentBillingMonthKey();

  const [{ accounts, error, tableMissing }, revenueReport] = await Promise.all([
    listPaymentAccounts(supabase, { activeOnly: false }),
    getBuildingRevenueReport(supabase, { billingMonth: month }),
  ]);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Accounts & QR mapping
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Link each receive QR or UPI ID to Joint, Kasi, Kanthu, or Pratyu.
          See building C/D collections, expenses, and net below — tag who paid
          on water, maintenance, and other expenses for accurate splits.
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Summary month
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

      <PaymentAccountsPanel
        accounts={accounts}
        loadError={error}
        tableMissing={tableMissing}
      />
    </AdminLayout>
  );
}
