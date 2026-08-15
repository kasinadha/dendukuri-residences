"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPasswordAction } from "@/app/login/actions";

type LoginAs = "tenant" | "admin";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [loginAs, setLoginAs] = useState<LoginAs>("tenant");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const as = searchParams.get("as");
    if (as === "admin" || as === "tenant") {
      setLoginAs(as);
    }

    const reason = searchParams.get("error");
    if (reason === "unauthorized") {
      setError(
        "Signed in, but this account does not match the portal you selected. Use Tenant or Admin according to your profiles.role."
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
    formData.set("login_as", loginAs);

    startTransition(async () => {
      const result = await signInWithPasswordAction(formData);
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

      <h1 className="mt-2 text-3xl font-bold text-slate-950">Sign in</h1>

      <p className="mt-2 text-sm text-slate-500">
        Choose Tenant or Admin, then sign in with email or mobile + password.
      </p>

      <div
        className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1"
        role="tablist"
        aria-label="Sign in as"
      >
        <button
          type="button"
          role="tab"
          aria-selected={loginAs === "tenant"}
          disabled={pending}
          onClick={() => setLoginAs("tenant")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            loginAs === "tenant"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Tenant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={loginAs === "admin"}
          disabled={pending}
          onClick={() => setLoginAs("admin")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            loginAs === "admin"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Admin
        </button>
      </div>

      <form onSubmit={handleLogin} className="mt-6 space-y-5">
        <input type="hidden" name="login_as" value={loginAs} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Email or mobile
          </label>

          <input
            type="text"
            name="identifier"
            required
            autoComplete="username"
            inputMode="email"
            placeholder={
              loginAs === "tenant"
                ? "email@example.com or 94928xxxxx"
                : "admin@example.com"
            }
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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
          {pending
            ? "Signing in..."
            : loginAs === "admin"
              ? "Sign in as Admin"
              : "Sign in as Tenant"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Paying rent or dues without an account?{" "}
        <a
          href="/pay"
          className="font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Pay without login
        </a>
      </p>
    </div>
  );
}
