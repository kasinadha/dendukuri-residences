import Link from "next/link";
import { Receipt } from "lucide-react";

export default function TenantHomePage() {
  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">WELCOME</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Your rental account
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        View rent receipts issued for your flat. Payment records are managed by
        the property owner and cannot be edited here.
      </p>

      <Link
        href="/tenant/receipts"
        className="mt-8 flex max-w-md items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <Receipt size={22} aria-hidden />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">
              Rent receipts
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              View and print your payment receipts
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}
