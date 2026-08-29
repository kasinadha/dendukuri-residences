import AdminLayout from "@/components/admin/AdminLayout";
import OperationalExpensesPanel from "@/components/admin/OperationalExpensesPanel";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForSelect } from "@/lib/electricity";
import { formatExpenseLocation } from "@/lib/expense-location";
import { listOperationalExpenses } from "@/lib/operational-expenses";
import { listPaymentAccounts, toPaymentAccountOptions } from "@/lib/payment-accounts";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

export default async function ExpensesPage() {
  const { supabase } = await requireAdmin();
  const [flats, expenses, accountsResult] = await Promise.all([
    listFlatsForSelect(supabase),
    listOperationalExpenses(supabase),
    listPaymentAccounts(supabase),
  ]);
  const accounts = accountsResult.accounts;

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Other Expenses
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Record cleaning, supplies, society fees, and other costs with building,
          flat, and who paid.
        </p>
      </div>
      <OperationalExpensesPanel
        flats={flats}
        accounts={toPaymentAccountOptions(accounts)}
        rows={expenses.map((row) => ({
          id: row.id,
          expenseDate: formatDisplayDate(row.expenseDate),
          title: row.title,
          category: row.category,
          amountLabel: formatInr(row.amount),
          locationLabel: formatExpenseLocation({
            buildingWing: row.buildingWing,
            flatNumber: row.flatNumber,
          }),
          payerLabel: row.payerAccountLabel,
          notes: row.notes,
        }))}
      />
    </AdminLayout>
  );
}
