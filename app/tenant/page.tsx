import Link from "next/link";
import {
  Receipt,
  Zap,
  Wrench,
  DoorOpen,
  ChevronRight,
  IndianRupee,
  ScrollText,
  Cctv,
} from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { listElectricityReadings } from "@/lib/electricity";
import { listMaintenanceRequests } from "@/lib/maintenance";
import { paymentStatusLabel } from "@/lib/payment-status";
import { formatInr, listReceiptViews } from "@/lib/receipts";
import { getTenantMonthDue } from "@/lib/reminders";
import { getTenantDuesSupabaseClient } from "@/lib/tenant-dues-client";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantHomePage() {
  const { supabase, user, profile } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const duesClient = getTenantDuesSupabaseClient(supabase);
  const receipts = (
    await listReceiptViews(duesClient, { limit: 20, tenantProfileId: user.id })
  ).filter((row) => row.tenantProfileId === user.id);
  const electricity = ctx?.flatId
    ? await listElectricityReadings(supabase, { flatId: ctx.flatId, limit: 3 })
    : [];
  const maintenance = ctx?.flatId
    ? await listMaintenanceRequests(supabase, { flatId: ctx.flatId, limit: 3 })
    : [];
  const monthDue = ctx?.tenancyId
    ? await getTenantMonthDue(duesClient, ctx.tenancyId)
    : null;

  const latestReceipt = receipts[0] ?? null;
  const rentUnpaid =
    monthDue &&
    monthDue.outstanding > 0 &&
    monthDue.status !== "paid" &&
    monthDue.status !== "waived";

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
        <>
          {rentUnpaid && monthDue ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                  Monthly dues · {monthDue.billingMonthKey}
                </p>
                <p className="mt-1 text-lg font-bold text-amber-950">
                  Outstanding {formatInr(monthDue.outstanding)} ·{" "}
                  {paymentStatusLabel(monthDue.status)}
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  Due {formatInr(monthDue.totalDue)} (rent{" "}
                  {formatInr(monthDue.rentDue)}
                  {monthDue.chargesDue > 0
                    ? ` + charges ${formatInr(monthDue.chargesDue)}`
                    : ""}
                  {monthDue.finesCharge > 0
                    ? ` + fines ${formatInr(monthDue.finesCharge)}`
                    : ""}
                  ) · Paid {formatInr(monthDue.amountPaid)}
                </p>
              </div>
              <Link
                href="/tenant/pay"
                className="mt-4 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white sm:mt-0"
              >
                Pay now
              </Link>
            </div>
          ) : monthDue &&
            (monthDue.status === "paid" || monthDue.status === "waived") ? (
            <p className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              Monthly dues for {monthDue.billingMonthKey} are{" "}
              {paymentStatusLabel(monthDue.status).toLowerCase()}.
            </p>
          ) : null}

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
        </>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          {
            href: "/tenant/pay",
            icon: IndianRupee,
            title: "Pay dues",
            detail: "Rent, charges, electricity + submit UTR",
          },
          {
            href: "/tenant/receipts",
            icon: Receipt,
            title: "Rent receipts",
            detail: "View, print, and download PDFs",
          },
          {
            href: "/tenant/cameras",
            icon: Cctv,
            title: "Cameras",
            detail: "Common-area live view",
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
            href: "/tenant/agreement",
            icon: ScrollText,
            title: "Rental agreement",
            detail: "Read and accept house terms",
          },
          {
            href: "/tenant/vacate",
            icon: DoorOpen,
            title: "Move out or transfer",
            detail: "Leave the property, or shift to another flat",
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
