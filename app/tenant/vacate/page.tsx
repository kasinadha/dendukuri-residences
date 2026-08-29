import TenantVacateForm from "@/components/tenant/TenantVacateForm";
import { requireTenant } from "@/lib/auth";
import { listVacateRequests } from "@/lib/ops";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantVacatePage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const mine = ctx?.tenancyId
    ? await listVacateRequests(supabase, { tenancyId: ctx.tenancyId })
    : [];

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">MOVE</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Move out or transfer
      </h2>
      <p className="mt-2 text-slate-500">
        Submit notice to leave, or request a shift to another flat in the same
        property.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {ctx?.tenancyId ? (
          <TenantVacateForm />
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            There is no active tenancy on this login, so a move request cannot
            be submitted.
          </p>
        )}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">Your requests</h3>
          </div>
          {mine.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mine.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  <p className="font-semibold capitalize text-slate-900">
                    {row.requestType === "transfer"
                      ? "Transfer within"
                      : "Move out"}{" "}
                    · {row.status}
                  </p>
                  {row.preferredFlatNumber ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Preferred flat {row.preferredFlatNumber}
                    </p>
                  ) : null}
                  {row.reason ? (
                    <p className="mt-1 text-sm text-slate-500">{row.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
