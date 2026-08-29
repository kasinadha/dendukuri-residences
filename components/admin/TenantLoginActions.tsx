"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTenantLoginAction,
  resetTenantPasswordAction,
} from "@/app/admin/tenants/actions";

type Props = {
  tenantId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  hasPortalLogin: boolean;
};

export default function TenantLoginActions({
  tenantId,
  fullName,
  phone,
  email,
  hasPortalLogin,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function run(
    action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; loginEmail?: string }>,
    formData: FormData,
    okMessage: string
  ) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const extra =
        "loginEmail" in result && result.loginEmail
          ? ` Login email: ${result.loginEmail}`
          : "";
      setSuccess(okMessage + extra);
      setOpen(false);
      router.refresh();
    });
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(createTenantLoginAction, new FormData(event.currentTarget), "Portal login created.");
  }

  function onReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(resetTenantPasswordAction, new FormData(event.currentTarget), "Password updated.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            hasPortalLogin
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {hasPortalLogin ? "Login active" : "No login"}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setError("");
            setSuccess("");
          }}
          className="text-xs font-semibold text-emerald-700"
        >
          {open
            ? "Close"
            : hasPortalLogin
              ? "Reset password"
              : "Create login"}
        </button>
      </div>

      {open ? (
        hasPortalLogin ? (
          <form onSubmit={onReset} className="rounded-xl bg-slate-50 p-3">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <p className="text-xs text-slate-600">
              {fullName} can sign in with mobile {phone ?? "—"} and this new
              password.
            </p>
            <label className="mt-2 block text-xs">
              <span className="mb-1 block font-semibold text-slate-700">
                New password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : (
          <form onSubmit={onCreate} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <p className="text-xs text-amber-900">
              Do not use Supabase → Authentication → Users (email-only form).
              Create logins here with mobile + password.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Tenant signs in at /login with their 10-digit mobile and password.
              Email below is optional.
            </p>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-700">
                Mobile (10 digits)
              </span>
              <input
                name="mobile"
                required
                inputMode="tel"
                defaultValue={phone ?? ""}
                placeholder="94928xxxxx"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-700">
                Email (optional)
              </span>
              <input
                type="email"
                name="email"
                defaultValue={email ?? ""}
                placeholder="Or leave blank — mobile login only"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-700">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create portal login"}
            </button>
          </form>
        )
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
    </div>
  );
}
