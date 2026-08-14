import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import RecordPaymentForm, {
  type TenancyOption,
} from "@/components/admin/RecordPaymentForm";
import { requireAdmin } from "@/lib/auth";
import {
  formatDisplayDate,
  formatInr,
  listReceiptViews,
} from "@/lib/receipts";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function PaymentsPage() {
  const { supabase } = await requireAdmin();

  const { data: tenancyRows } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      tenants ( full_name ),
      flats ( flat_number )
    `
    )
    .order("created_at", { ascending: false });

  const tenancies: TenancyOption[] = (tenancyRows ?? [])
    .filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return status === "active" || status === "occupied" || status === "";
    })
    .map((row) => {
      const tenant = unwrapOne(row.tenants);
      const flat = unwrapOne(row.flats);
      const rent =
        row.monthly_rent == null ? null : Number(row.monthly_rent);
      return {
        id: row.id,
        monthlyRent: Number.isFinite(rent) ? rent : null,
        label: `Flat ${flat?.flat_number ?? "?"} — ${tenant?.full_name ?? "Tenant"}`,
      };
    });

  // If status filter emptied the list, fall back to all tenancies.
  const tenancyOptions =
    tenancies.length > 0
      ? tenancies
      : (tenancyRows ?? []).map((row) => {
          const tenant = unwrapOne(row.tenants);
          const flat = unwrapOne(row.flats);
          const rent =
            row.monthly_rent == null ? null : Number(row.monthly_rent);
          return {
            id: row.id,
            monthlyRent: Number.isFinite(rent) ? rent : null,
            label: `Flat ${flat?.flat_number ?? "?"} — ${tenant?.full_name ?? "Tenant"}`,
          };
        });

  const receipts = await listReceiptViews(supabase, { limit: 40 });

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Rent & Payments
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Record rent collections and issue receipts with unique receipt
            numbers.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordPaymentForm tenancies={tenancyOptions} />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900">Recent receipts</h3>
            <p className="mt-1 text-sm text-slate-500">
              Open any receipt to print or save as PDF.
            </p>
          </div>

          {receipts.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No receipts yet. Record a payment to generate the first one.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {receipts.map((receipt) => (
                <li key={receipt.receiptId}>
                  <Link
                    href={`/admin/receipts/${receipt.receiptId}`}
                    className="flex flex-col gap-1 px-5 py-4 transition hover:bg-emerald-50/60 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {receipt.receiptNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Flat {receipt.flatNumber} · {receipt.tenantName} ·{" "}
                        {receipt.billingMonth}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-slate-900">
                        {formatInr(receipt.rentAmount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Paid {formatDisplayDate(receipt.paymentDate)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
