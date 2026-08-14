"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 15000;

async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out after ${ms / 1000}s. Check network / Supabase URL.`
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("error");
    if (reason === "unauthorized") {
      setError(
        "Signed in, but this account is not allowed into admin/tenant. Check profiles.role and is_active in Supabase."
      );
    } else if (reason === "session") {
      setError(
        "No active session after login. Cookies may be blocked, or Supabase env keys may be wrong."
      );
    }
  }, [searchParams]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("Contacting Supabase Auth…");

    const supabase = createClient();

    try {
      const { data: authData, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        AUTH_TIMEOUT_MS,
        "Sign-in"
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError("Login failed. Please try again.");
        return;
      }

      setStatus("Loading profile…");
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", userId)
          .maybeSingle(),
        AUTH_TIMEOUT_MS,
        "Profile lookup"
      );

      if (profileError) {
        await supabase.auth.signOut();
        setError(
          `Could not load profile (${profileError.message}). Check RLS policies on profiles.`
        );
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setError(
          "Signed in to Auth, but no profiles row exists for this user. In Supabase SQL editor, insert a profiles row with role='admin' and is_active=true matching your auth.users id."
        );
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError(
          "Your profile exists but is_active is false. Set is_active=true in the profiles table."
        );
        return;
      }

      if (profile.role === "admin") {
        setStatus("Redirecting to admin…");
        window.location.assign("/admin");
        return;
      }

      if (profile.role === "tenant") {
        setStatus("Redirecting to tenant…");
        window.location.assign("/tenant");
        return;
      }

      await supabase.auth.signOut();
      setError(
        `Profile role is "${profile.role ?? "unknown"}" — expected "admin" or "tenant". Update profiles.role in Supabase.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
      setStatus("");
    }
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
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Password
          </label>

          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:opacity-60"
          />
        </div>

        {status ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {status}
          </p>
        ) : null}

        {error ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
