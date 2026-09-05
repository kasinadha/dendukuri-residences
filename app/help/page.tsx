import type { Metadata } from "next";
import TenantHelpGuide from "@/components/help/TenantHelpGuide";
import { getSessionProfile } from "@/lib/auth";
import {
  getPendingNameChangeForTenant,
  listTenantChangeRequestsForTenant,
  type HelpNameCorrection,
  type TenantChangeRequest,
} from "@/lib/tenant-change-requests";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export const metadata: Metadata = {
  title: "Tenant help & FAQ | Dendukuri's Residences",
  description:
    "Step-by-step guide for tenants: sign in, pay rent via UPI, receipts, electricity, maintenance, name corrections, and move-out.",
};

export default async function TenantHelpPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const isTenant = Boolean(
    user && profile?.is_active && profile.role === "tenant"
  );

  let nameCorrection: HelpNameCorrection = { status: "guest" };
  if (isTenant && user) {
    const ctx = await getTenantPortalContext(supabase, user.id).catch(
      () => null
    );
    if (!ctx?.tenantId) {
      nameCorrection = { status: "unlinked" };
    } else {
      const [pending, history] = await Promise.all([
        getPendingNameChangeForTenant(supabase, ctx.tenantId).catch(
          () => null
        ),
        listTenantChangeRequestsForTenant(supabase, ctx.tenantId).catch(
          () => [] as TenantChangeRequest[]
        ),
      ]);
      nameCorrection = {
        status: "ready",
        currentName: (profile?.full_name ?? ctx.fullName).trim() || "Tenant",
        pending,
        latest: history[0] ?? null,
      };
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <TenantHelpGuide isTenant={isTenant} nameCorrection={nameCorrection} />
    </main>
  );
}
