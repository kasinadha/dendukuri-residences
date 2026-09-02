import TenantRentPaymentForm from "@/components/tenant/TenantRentPaymentForm";
import { requireTenant } from "@/lib/auth";
import { getFlatPaymentDetails } from "@/lib/flats";
import { listPaymentSubmissions } from "@/lib/payment-submissions";
import { formatBillingMonthLabel, formatInr } from "@/lib/receipts";
import {
  currentBillingMonthKey,
  resolveRentUpiDisplay,
} from "@/lib/rent-upi";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantPayPage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const flatUpi = ctx?.flatId
    ? await getFlatPaymentDetails(supabase, ctx.flatId)
    : null;
  const { upiId, upiQrUrl, payeeName } = resolveRentUpiDisplay(flatUpi);
  const billingMonth = currentBillingMonthKey();

  const submissions = ctx?.tenancyId
    ? await listPaymentSubmissions(supabase, {
        tenancyId: ctx.tenancyId,
        limit: 20,
      })
    : [];

  if (!ctx?.tenancyId) {
    return (
      <div>
        <p className="text-sm font-semibold text-emerald-700">PAY DUES</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Pay dues
        </h2>
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your login is not linked to an active tenancy yet. Ask the owner to
          link <code>tenants.profile_id</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">PAY DUES</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Pay dues via UPI
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Flat {ctx.flatNumber ?? "—"}
        {ctx.monthlyRent != null ? ` · ${formatInr(ctx.monthlyRent)} / month rent` : ""}
        . Pay the outstanding amount (rent, charges, electricity, and any arrears)
        to the UPI ID, then submit your UTR for confirmation.
      </p>

      <div className="mt-8">
        <TenantRentPaymentForm
          tenancyId={ctx.tenancyId}
          flatNumber={ctx.flatNumber ?? "—"}
          monthlyRent={ctx.monthlyRent}
          defaultBillingMonth={billingMonth}
          upiId={upiId}
          upiQrUrl={upiQrUrl}
          payeeName={payeeName}
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Your submissions</h3>
        </div>
        {submissions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {submissions.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {formatBillingMonthLabel(row.billingMonth)} ·{" "}
                    {formatInr(row.amount)}
                  </p>
                  <p className="text-sm text-slate-500">UTR {row.utr}</p>
                  {row.proofUrl ? (
                    <a
                      href={row.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-semibold text-emerald-700"
                    >
                      View proof
                    </a>
                  ) : null}
                </div>
                <span className="text-sm font-semibold capitalize text-slate-700">
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
