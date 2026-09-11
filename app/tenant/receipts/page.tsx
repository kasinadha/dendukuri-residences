import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { formatDisplayDate, formatInr, listReceiptViews } from "@/lib/receipts";
import { getTenantDuesSupabaseClient } from "@/lib/tenant-dues-client";

export default async function TenantReceiptsPage() {
  const { supabase, user } = await requireTenant();
  const duesClient = getTenantDuesSupabaseClient(supabase);

  // Prefer RLS; also filter by linked profile_id as defense in depth.
  const receipts = (await listReceiptViews(duesClient, { limit: 100 })).filter(
    (row) => row.tenantProfileId === user.id
  );

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">RECEIPTS</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Your rent receipts
      </h2>
      <p className="mt-2 text-slate-500">
        View-only access to receipts for your tenancy.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {receipts.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No receipts are available yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <li
                key={receipt.receiptId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/tenant/receipts/${receipt.receiptId}`}
                  className="min-w-0 flex-1 transition hover:text-emerald-800"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {receipt.receiptNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Flat {receipt.flatNumber} · {receipt.billingMonth}
                    </p>
                  </div>
                  <div className="mt-2 sm:hidden">
                    {receipt.amountDue != null &&
                    receipt.amountPaid < receipt.amountDue ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          Paid {formatInr(receipt.amountPaid)}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Due {formatInr(receipt.amountDue)} · Balance{" "}
                          {formatInr(receipt.amountDue - receipt.amountPaid)}
                        </p>
                      </>
                    ) : (
                      <p className="font-semibold text-slate-900">
                        {formatInr(receipt.amountPaid)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Paid {formatDisplayDate(receipt.paymentDate)}
                    </p>
                  </div>
                </Link>
                <div className="hidden text-right sm:block">
                  {receipt.amountDue != null &&
                  receipt.amountPaid < receipt.amountDue ? (
                    <>
                      <p className="font-semibold text-slate-900">
                        Paid {formatInr(receipt.amountPaid)}
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Due {formatInr(receipt.amountDue)} · Balance{" "}
                        {formatInr(receipt.amountDue - receipt.amountPaid)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDisplayDate(receipt.paymentDate)} · Partial
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">
                        {formatInr(receipt.amountPaid)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Paid {formatDisplayDate(receipt.paymentDate)}
                      </p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
