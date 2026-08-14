import { notFound } from "next/navigation";
import ReceiptDocument from "@/components/receipts/ReceiptDocument";
import { requireTenant } from "@/lib/auth";
import { fetchReceiptViewById } from "@/lib/receipts";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TenantReceiptDetailPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await requireTenant();

  const receipt = await fetchReceiptViewById(supabase, id);

  // RLS should already scope rows; also enforce profile ownership in-app.
  if (!receipt || receipt.tenantProfileId !== user.id) {
    notFound();
  }

  return <ReceiptDocument receipt={receipt} viewer="tenant" />;
}
