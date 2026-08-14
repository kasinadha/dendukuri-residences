import AdminLayout from "@/components/admin/AdminLayout";
import VendorsPanel from "@/components/admin/VendorsPanel";
import { requireAdmin } from "@/lib/auth";
import { listVendors } from "@/lib/ops";

export default async function VendorsPage() {
  const { supabase } = await requireAdmin();
  const vendors = await listVendors(supabase);

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Vendors
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Contact directory for service providers used on the property.
        </p>
      </div>
      <VendorsPanel vendors={vendors} />
    </AdminLayout>
  );
}
