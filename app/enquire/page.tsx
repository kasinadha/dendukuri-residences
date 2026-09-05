import EnquireForm from "@/components/enquire/EnquireForm";
import Link from "next/link";

export default function EnquirePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-xl px-5 py-12">
        <p className="text-sm font-semibold text-emerald-700">
          Dendukuri&apos;s Residences
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Enquire about a home
        </h1>
        <p className="mt-2 text-slate-500">
          Answer a few questions so we can follow up on WhatsApp with the right
          flat, visit time, and rent range.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EnquireForm />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/" className="font-semibold text-emerald-700">
            ← Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
