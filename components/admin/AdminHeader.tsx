import LogoutButton from "./LogoutButton";
import { Bell, CalendarDays, UserCircle2 } from "lucide-react";

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export default function AdminHeader() {
  const monthLabel = currentMonthLabel();

  return (
    <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
      <div>
        <p className="text-sm text-slate-500">Property Management</p>
        <h1 className="text-xl font-bold text-slate-900">
          Dendukuri&apos;s Residences
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600 sm:flex">
          <CalendarDays size={17} aria-hidden />
          {monthLabel}
        </div>

        <button className="rounded-xl border border-slate-200 p-2.5 text-slate-600">
          <Bell size={19} />
        </button>

        <LogoutButton />

        <div className="flex items-center gap-2">
          <UserCircle2 size={30} className="text-slate-600" />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold">Admin</p>
            <p className="text-xs text-slate-500">Owner</p>
          </div>
        </div>
      </div>
    </header>
  );
}
