"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/app/login/sign-out-action";

type Props = {
  /** Prefill Tenant/Admin toggle after logout. */
  loginAs?: "admin" | "tenant";
};

export default function LogoutButton({ loginAs = "admin" }: Props) {
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(() => {
      void signOutAction(loginAs);
    });
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <LogOut size={17} />
      <span className="hidden md:inline">Logout</span>
    </button>
  );
}
