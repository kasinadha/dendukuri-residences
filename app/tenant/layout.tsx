import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "@/components/admin/LogoutButton";
import { requireTenant } from "@/lib/auth";

const nav = [
  { href: "/tenant", label: "Home" },
  { href: "/tenant/pay", label: "Pay rent" },
  { href: "/tenant/receipts", label: "Receipts" },
  { href: "/tenant/electricity", label: "Electricity" },
  { href: "/tenant/maintenance", label: "Maintenance" },
  { href: "/tenant/vacate", label: "Move / transfer" },
] as const;

export default async function TenantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireTenant();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Dendukuri&apos;s Residences
            </p>
            <h1 className="text-lg font-bold text-slate-900">Tenant portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {profile.full_name ?? "Tenant"}
              </p>
              <p className="text-xs text-slate-500">Tenant</p>
            </div>
            <LogoutButton loginAs="tenant" />
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
