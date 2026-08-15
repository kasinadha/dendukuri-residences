import Link from "next/link";
import {
  Receipt,
  Zap,
  Wrench,
  DoorOpen,
  ChevronRight,
  IndianRupee,
} from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { listElectricityReadings } from "@/lib/electricity";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { formatInr, listReceiptViews } from "@/lib/receipts";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantHomePage() {
  const { supabase, user, profile } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const receipts = (await listReceiptViews(supabase, { limit: 20 })).filter(
    (row) => row.tenantProfileId === user.id
  );
  const electricity = ctx?.flatId
    ? await listElectricityReadings(supabase, { flatId: ctx.flatId, limit: 3 })
    : [];
  const maintenance = ctx?.flatId
    ? await listMaintenanceRequests(supabase, { flatId: ctx.flatId, limit: 3 })
    : [];

  const latestReceipt = receipts[0] ?? null;

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">WELCOME</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {profile.full_name ?? ctx?.fullName ?? "Your rental account"}
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Rent status, receipts, electricity, and maintenance for your flat.
      </p>

      {!ctx ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your login is not linked to a tenant profile yet. Ask the owner to set
          `tenants.profile_id` to your auth user id.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Flat</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {ctx.flatNumber ?? "—"}
            </p>
            <p className="mt-2 text-xs capitalize text-slate-500">
              {ctx.tenancyStatus ?? "no tenancy"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Monthly rent</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {ctx.monthlyRent != null ? formatInr(ctx.monthlyRent) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Latest receipt</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {latestReceipt ? formatInr(latestReceipt.rentAmount) : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {latestReceipt?.billingMonth ?? "None yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Open maintenance</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {
                maintenance.filter(
                  (m) =>
                    m.status === "open" || m.status === "in_progress"
                ).length
              }
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          {
            href: "/tenant/pay",
            icon: IndianRupee,
            title: "Pay rent",
            detail: "UPI / QR + submit UTR for confirmation",
          },
          {
            href: "/tenant/receipts",
            icon: Receipt,
            title: "Rent receipts",
            detail: "View and print payment receipts",
          },
          {
            href: "/tenant/electricity",
            icon: Zap,
            title: "Electricity",
            detail: `${electricity.length} recent reading(s)`,
          },
          {
            href: "/tenant/maintenance",
            icon: Wrench,
            title: "Maintenance",
            detail: "Raise or track repair requests",
          },
          {
            href: "/tenant/vacate",
            icon: DoorOpen,
            title: "Vacate request",
            detail: "Submit notice to leave",
          },
        ].map(({ href, icon: Icon, title, detail }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <span className="flex items-center gap-3">
              <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Icon size={22} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">
                  {title}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {detail}
                </span>
              </span>
            </span>
            <ChevronRight className="hidden text-slate-300 sm:block" size={18} />
          </Link>
        ))}
      </div>
    </div>
  );
}
