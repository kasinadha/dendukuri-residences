"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPasswordAction } from "@/app/login/actions";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const reason = searchParams.get("error");
    if (reason === "unauthorized") {
      setError(
        "Signed in, but this account is not allowed into admin/tenant. Check profiles.role and is_active in Supabase."
      );
    } else if (reason === "session") {
      setError(
        "No active session was found. Try signing in again. If it keeps happening, confirm .env.local matches your Supabase project."
      );
    }
  }, [searchParams]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signInWithPasswordAction(formData);
      // Successful login redirects on the server and never returns.
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
        Dendukuri&apos;s Residences
      </p>

      <h1 className="mt-2 text-3xl font-bold text-slate-950">
        Management Login
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        Sign in to access the property management dashboard.
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Email
          </label>

          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Password
          </label>

          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:opacity-60"
          />
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
