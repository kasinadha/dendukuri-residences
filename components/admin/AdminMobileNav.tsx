"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "./AdminSidebar";

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {adminNavItems.map(({ label, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                active
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
