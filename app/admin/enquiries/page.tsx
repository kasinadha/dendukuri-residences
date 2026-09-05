import AdminLayout from "@/components/admin/AdminLayout";
import AdminEnquiriesClient from "@/components/admin/AdminEnquiriesClient";
import { requireAdmin } from "@/lib/auth";
import {
  getEnquiryById,
  listEnquiries,
  listEnquiryFollowups,
} from "@/lib/enquiries";

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const enquiries = await listEnquiries(supabase);
  const selectedId = params.id || enquiries[0]?.id || null;
  const selected = selectedId
    ? (enquiries.find((row) => row.id === selectedId) ??
      (await getEnquiryById(supabase, selectedId)))
    : null;
  const followups = selected
    ? await listEnquiryFollowups(supabase, selected.id)
    : [];

  const overdueCount = enquiries.filter((row) => row.overdue).length;

  return (
    <AdminLayout>
      <p className="text-sm font-semibold text-emerald-700">MODULE</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        Enquiries
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500">
        Questionnaire answers from the public form, with WhatsApp follow-up until
        they convert or say they are not looking.
        {overdueCount > 0
          ? ` ${overdueCount} follow-up${overdueCount === 1 ? "" : "s"} due.`
          : ""}
      </p>
      <div className="mt-8">
        <AdminEnquiriesClient
          enquiries={enquiries}
          selected={selected}
          followups={followups}
        />
      </div>
    </AdminLayout>
  );
}
