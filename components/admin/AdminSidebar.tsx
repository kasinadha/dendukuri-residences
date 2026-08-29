"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  IndianRupee,
  Zap,
  Wrench,
  Droplets,
  ContactRound,
  CircleHelp,
  BarChart3,
  Landmark,
} from "lucide-react";

export const adminNavItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Flats", href: "/admin/flats", icon: Building2 },
  { label: "Tenants", href: "/admin/tenants", icon: Users },
  { label: "Rent & Payments", href: "/admin/payments", icon: IndianRupee },
  { label: "Accounts", href: "/admin/accounts", icon: Landmark },
  { label: "Electricity", href: "/admin/electricity", icon: Zap },
  { label: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { label: "Water Tankers", href: "/admin/water", icon: Droplets },
  { label: "Vendors", href: "/admin/vendors", icon: ContactRound },
  { label: "FAQs", href: "/admin/faqs", icon: CircleHelp },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 bg-slate-950 text-white lg:flex lg:flex-col">
      <div className="border-b border-slate-800 p-6">
        <p className="text-xl font-bold">Dendukuri&apos;s</p>
        <p className="text-sm font-semibold text-emerald-400">Residences</p>
        <p className="mt-2 text-xs text-slate-500">Property Management</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {adminNavItems.map(({ label, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                active
                  ? "bg-emerald-500 font-semibold text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-5 text-xs text-slate-500">
        Owner Administration
      </div>
    </aside>
  );
}
