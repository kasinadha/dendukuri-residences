import TenantAgreementAcceptForm from "@/components/tenant/TenantAgreementAcceptForm";
import { requireTenant } from "@/lib/auth";
import { getLatestAgreementForTenancy } from "@/lib/agreements";
import { formatDisplayDate } from "@/lib/receipts";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantAgreementPage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const agreement = ctx?.tenancyId
    ? await getLatestAgreementForTenancy(supabase, ctx.tenancyId)
    : null;

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">AGREEMENT</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Rental terms
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Confirm rent, maintenance, other charges, deposit, move-in date, and the
        house rules for Flat {ctx?.flatNumber ?? "—"}.
      </p>

      {!agreement || agreement.adminStatus !== "approved" ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          The owner has not released rental terms for your flat yet. You will see
          a banner here once they are approved.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <article className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm sm:p-6">
            <h3 className="text-lg font-bold text-slate-900">
              {agreement.templateTitle ?? "Rental agreement"}
            </h3>
            {(agreement.templateVersion || agreement.moveInDate) ? (
              <p className="mt-1 text-xs text-slate-500">
                {[
                  agreement.templateVersion
                    ? `Version ${agreement.templateVersion}`
                    : null,
                  agreement.moveInDate
                    ? `Move-in ${formatDisplayDate(agreement.moveInDate)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <div className="mt-4">{agreement.templateBody}</div>
          </article>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <TenantAgreementAcceptForm agreement={agreement} />
          </div>
        </div>
      )}
    </div>
  );
}
