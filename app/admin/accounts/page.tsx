import AdminLayout from "@/components/admin/AdminLayout";
import PaymentAccountsPanel from "@/components/admin/PaymentAccountsPanel";
import { requireAdmin } from "@/lib/auth";
import { listPaymentAccounts } from "@/lib/payment-accounts";

export default async function AccountsPage() {
  const { supabase } = await requireAdmin();
  const { accounts, error, tableMissing } = await listPaymentAccounts(supabase, {
    activeOnly: false,
  });

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Accounts & QR mapping
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Link each receive QR or UPI ID to Joint, Kasi, Kanthu, or Pratyu so
          rent collections and expenses can be split correctly.
        </p>
      </div>

      <PaymentAccountsPanel
        accounts={accounts}
        loadError={error}
        tableMissing={tableMissing}
      />
    </AdminLayout>
  );
}
