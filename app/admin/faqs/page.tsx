import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin } from "@/lib/auth";

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

export default async function FaqsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("faqs")
    .select("id,question,answer,category,created_at")
    .order("created_at", { ascending: false });

  const faqs = (data ?? []) as FaqRow[];

  return (
    <AdminLayout>
      <div>
        <p className="text-sm font-semibold text-emerald-700">MODULE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          FAQs
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          Common answers stored in Supabase for tenant and operations support.
        </p>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {faqs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No FAQs yet. Add rows in the Supabase `faqs` table (question, answer,
            category).
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {faqs.map((faq) => (
              <li key={faq.id} className="px-5 py-5 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {faq.category ?? "General"}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {faq.question}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {faq.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
