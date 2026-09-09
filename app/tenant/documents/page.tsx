import TenantDocumentsForm from "@/components/tenant/TenantDocumentsForm";
import { requireTenant } from "@/lib/auth";
import { listTenantDocuments } from "@/lib/tenant-documents";
import { getTenantPortalContext } from "@/lib/tenant-portal";

export default async function TenantDocumentsPage() {
  const { supabase, user } = await requireTenant();
  const ctx = await getTenantPortalContext(supabase, user.id);
  const documents = ctx?.tenantId
    ? await listTenantDocuments(supabase, ctx.tenantId)
    : [];

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-700">PROFILE</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Your documents
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Upload a government ID and current employment proof for Flat{" "}
        {ctx?.flatNumber ?? "—"}. These stay private — only you and the owner
        can view them.
      </p>
      {!ctx ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your login is not linked to a tenant profile yet.
        </p>
      ) : (
        <TenantDocumentsForm documents={documents} />
      )}
    </div>
  );
}
