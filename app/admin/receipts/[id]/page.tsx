import { notFound } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import ReceiptDocument from "@/components/receipts/ReceiptDocument";
import { requireAdmin } from "@/lib/auth";
import { fetchReceiptViewById } from "@/lib/receipts";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminReceiptPage({ params }: Props) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const receipt = await fetchReceiptViewById(supabase, id);

  if (!receipt) {
    notFound();
  }

  return (
    <AdminLayout>
      <ReceiptDocument receipt={receipt} viewer="admin" />
    </AdminLayout>
  );
}
