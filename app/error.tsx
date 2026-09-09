"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">
          This page couldn’t load
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Something went wrong. Try again, or go back home and continue.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-slate-400">Reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Home
          </a>
        </div>
      </div>
    </main>
  );
}
