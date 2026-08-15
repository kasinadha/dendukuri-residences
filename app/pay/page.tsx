import Link from "next/link";
import PublicPayForm from "@/components/pay/PublicPayForm";

export default function PublicPayPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="text-sm font-bold text-slate-900">
            Dendukuri&apos;s{" "}
            <span className="text-emerald-700">Residences</span>
          </Link>
          <Link
            href="/login?as=tenant"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <p className="text-sm font-semibold text-emerald-700">PAY WITHOUT LOGIN</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Pay rent or dues
        </h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Flat number is required. Choose rent, advance (deposit), or
          maintenance, pay via UPI, then submit your UTR. The owner confirms
          before any receipt is issued.
        </p>

        <div className="mt-8">
          <PublicPayForm />
        </div>
      </div>
    </main>
  );
}
