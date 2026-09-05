import AdminLayout from "@/components/admin/AdminLayout";
import BuildingRevenuePanel from "@/components/admin/BuildingRevenuePanel";
import FlatUpiAccountsPanel from "@/components/admin/FlatUpiAccountsPanel";
import PaymentAccountsPanel from "@/components/admin/PaymentAccountsPanel";
import { requireAdmin } from "@/lib/auth";
import { getBuildingRevenueReport } from "@/lib/building-revenue";
import { listFlatsForUpiMapping } from "@/lib/flats";
import {
  listPaymentAccounts,
  toPaymentAccountOptions,
} from "@/lib/payment-accounts";
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

  const [{ accounts, error, tableMissing }, revenueReport, flats] =
    await Promise.all([
      listPaymentAccounts(supabase, { activeOnly: false }),
      getBuildingRevenueReport(supabase, { billingMonth: month }),
      listFlatsForUpiMapping(supabase),
    ]);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Accounts & QR mapping
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Map owner receive accounts (Joint, Kasi, Kanthu, Pratyu), then set a
          UPI ID and QR for each flat. Tenants pay with the flat&apos;s UPI
          first; empty flats fall back to Joint. Deposits stay separate from
          monthly dues.
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Due month
            </span>
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block max-w-xs text-xs text-slate-500">
              Rent due month (5th of this month). Electricity follows the meter
              usage month — August bill, even if you entered readings in
              September.
            </span>
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

      <FlatUpiAccountsPanel
        flats={flats}
        accounts={toPaymentAccountOptions(accounts)}
      />
    </AdminLayout>
  );
}
