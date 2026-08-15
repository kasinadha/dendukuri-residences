"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Prefill Tenant/Admin toggle after logout. */
  loginAs?: "admin" | "tenant";
};

export default function LogoutButton({ loginAs = "admin" }: Props) {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/login?as=${loginAs}`;
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
    >
      <LogOut size={17} />
      <span className="hidden md:inline">Logout</span>
    </button>
  );
}
