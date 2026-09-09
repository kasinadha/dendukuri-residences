import AdminLayout from "@/components/admin/AdminLayout";
import AdminAgreementsClient from "@/components/admin/AdminAgreementsClient";
import { requireAdmin } from "@/lib/auth";
import {
  getCurrentAgreementTemplate,
  listAgreementTemplates,
  listTenancyAgreements,
} from "@/lib/agreements";
import { listTenantFines } from "@/lib/fines";
import { listTenantsForAdmin } from "@/lib/tenants";
import { getWhatsAppBusinessConfig } from "@/lib/whatsapp";

export default async function AdminAgreementsPage() {
  const { supabase } = await requireAdmin();
  const [template, templates, agreements, fines, tenants] = await Promise.all([
    getCurrentAgreementTemplate(supabase),
    listAgreementTemplates(supabase),
    listTenancyAgreements(supabase),
    listTenantFines(supabase, { limit: 30 }),
    listTenantsForAdmin(supabase),
  ]);

  const fineOptions = tenants
    .filter((row) => row.hasActiveTenancy && row.tenancyId)
    .map((row) => ({
      tenancyId: row.tenancyId as string,
      label: `Flat ${row.flatNumber ?? "—"} · ${row.fullName}`,
    }));

  return (
    <AdminLayout>
      <p className="text-sm font-semibold text-emerald-700">MODULE</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Agreements
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Approve terms per flat, remind tenants who have not accepted, and record
        waste-dumping fines that go onto dues.
      </p>
      <div className="mt-8">
        <AdminAgreementsClient
          template={template}
          templates={templates}
          agreements={agreements}
          fines={fines}
          fineOptions={fineOptions}
          whatsappApiEnabled={getWhatsAppBusinessConfig().apiEnabled}
        />
      </div>
    </AdminLayout>
  );
}
