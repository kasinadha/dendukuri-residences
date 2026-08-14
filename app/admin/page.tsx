import AdminLayout from "@/components/admin/AdminLayout";
import {
  Building2,
  Users,
  IndianRupee,
  CircleAlert,
  Zap,
  Droplets,
  Wrench,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForAdmin, summarizeFlats } from "@/lib/flats";
import { formatInr } from "@/lib/receipts";
import { listTenantsForAdmin } from "@/lib/tenants";

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export default async function AdminDashboard() {
  const { supabase } = await requireAdmin();
  const [flats, tenants] = await Promise.all([
    listFlatsForAdmin(supabase),
    listTenantsForAdmin(supabase),
  ]);

  const summary = summarizeFlats(flats);
  const monthLabel = currentMonthLabel();
  const vacantFlats = flats.filter((f) => !f.isOccupied).slice(0, 6);

  const stats = [
    {
      title: "Total Flats",
      value: String(summary.total),
      detail: "From Supabase inventory",
      icon: Building2,
    },
    {
      title: "Occupied",
      value: String(summary.occupied),
      detail: `${summary.vacant} currently vacant`,
      icon: Users,
    },
    {
      title: "Rent Expected",
      value: formatInr(summary.rentExpected),
      detail: monthLabel,
      icon: IndianRupee,
    },
    {
      title: "Tenants",
      value: String(tenants.length),
      detail: `${tenants.filter((t) => t.hasActiveTenancy).length} with active tenancy`,
      icon: CircleAlert,
    },
  ];

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">OVERVIEW</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Management Dashboard
          </h2>
          <p className="mt-2 text-slate-500">
            Rent, utilities and property operations in one place.
          </p>
        </div>

        <Link
          href="/admin/payments"
          className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white sm:mt-0"
        >
          Record Payment
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, value, detail, icon: Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Icon size={22} aria-hidden />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <div>
              <h3 className="text-lg font-bold">Vacant flats</h3>
              <p className="mt-1 text-sm text-slate-500">
                Units without an active tenancy
              </p>
            </div>
            <CircleAlert className="text-amber-500" aria-hidden />
          </div>

          {vacantFlats.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              {summary.total === 0
                ? "No flats loaded yet."
                : "All listed flats currently look occupied."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {vacantFlats.map((flat) => (
                <div
                  key={flat.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      Flat {flat.flatNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {flat.type !== "—" ? flat.type : "Type not set"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-800">
                    {flat.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 p-4">
            <Link
              href="/admin/flats"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-600"
            >
              View all flats →
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">Quick Actions</h3>
          <p className="mt-1 text-sm text-slate-500">Common management tasks</p>

          <div className="mt-5 space-y-3">
            {[
              {
                href: "/admin/payments",
                icon: IndianRupee,
                label: "Record Rent Payment",
              },
              {
                href: "/admin/flats",
                icon: Building2,
                label: "Review Flats",
              },
              {
                href: "/admin/tenants",
                icon: Users,
                label: "Review Tenants",
              },
              {
                href: "/admin/maintenance",
                icon: Wrench,
                label: "Add Maintenance / Repair",
              },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="flex items-center gap-3 font-medium text-slate-700">
                  <Icon size={19} className="text-emerald-700" aria-hidden />
                  {label}
                </span>
                <ArrowRight size={17} className="text-slate-400" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-6 text-white">
          <Zap className="text-amber-400" aria-hidden />
          <p className="mt-5 text-sm text-slate-400">Electricity</p>
          <p className="mt-1 text-xl font-bold">Meter & bill tracking</p>
        </div>

        <div className="rounded-2xl bg-emerald-700 p-6 text-white">
          <Droplets className="text-emerald-200" aria-hidden />
          <p className="mt-5 text-sm text-emerald-200">Water</p>
          <p className="mt-1 text-xl font-bold">Tanker orders & payments</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Wrench className="text-emerald-700" aria-hidden />
          <p className="mt-5 text-sm text-slate-500">Maintenance</p>
          <p className="mt-1 text-xl font-bold">Repairs & vendor history</p>
        </div>
      </div>
    </AdminLayout>
  );
}
