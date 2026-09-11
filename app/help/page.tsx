import type { Metadata } from "next";
import TenantHelpGuide from "@/components/help/TenantHelpGuide";

export const metadata: Metadata = {
  title: "Tenant help & FAQ | Dendukuri's Residences",
  description:
    "Step-by-step guide for tenants: sign in, pay rent via UPI, receipts, electricity, maintenance, and move-out.",
};

export default function TenantHelpPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <TenantHelpGuide />
    </main>
  );
}
