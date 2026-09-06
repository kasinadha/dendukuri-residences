import {
  documentKindLabel,
  governmentIdSubtypeLabel,
  type TenantDocument,
} from "@/lib/tenant-documents";

type TenantRef = {
  id: string;
  fullName: string;
  flatNumber: string | null;
};

export default function TenantDocumentsAdminPanel({
  tenants,
  documents,
}: {
  tenants: TenantRef[];
  documents: TenantDocument[];
}) {
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">
          ID and employment documents
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Tenants upload Aadhaar/PAN and employment proof in the portal. Files
          are private — open a link to view.
        </p>
      </div>
      {documents.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">
          No documents uploaded yet. After you run the 20260910 migration,
          tenants can upload from Menu → Documents.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const tenant = tenantById.get(doc.tenantId);
            const kindLabel =
              doc.kind === "government_id"
                ? governmentIdSubtypeLabel(doc.idSubtype)
                : documentKindLabel(doc.kind);
            return (
              <li
                key={doc.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {tenant?.fullName ?? "Tenant"}
                    {tenant?.flatNumber ? ` · Flat ${tenant.flatNumber}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {kindLabel}
                    {doc.originalFilename ? ` · ${doc.originalFilename}` : ""}
                  </p>
                </div>
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    View
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">Cannot open file</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
