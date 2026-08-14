import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";
import AdminLayout from "./AdminLayout";

type AdminModulePageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  eyebrow?: string;
};

export default function AdminModulePage({
  title,
  description,
  icon: Icon,
  eyebrow = "MODULE",
}: AdminModulePageProps) {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">{eyebrow}</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">{description}</p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 shadow-sm sm:p-12">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
            <Icon size={28} aria-hidden />
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <Construction size={14} aria-hidden />
            Coming soon
          </div>

          <h3 className="mt-4 text-xl font-bold text-slate-900">
            {title} is not ready yet
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This section is wired into navigation so you can keep exploring the
            admin shell. Content and workflows for {title.toLowerCase()} will
            land here next.
          </p>

          <Link
            href="/admin"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <ArrowLeft size={17} aria-hidden />
            Back to Dashboard
          </Link>
        </div>
      </section>
    </AdminLayout>
  );
}
