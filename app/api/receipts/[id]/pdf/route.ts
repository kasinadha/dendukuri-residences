import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { renderReceiptPdfBuffer, receiptPdfFileName } from "@/lib/receipt-pdf";
import { fetchReceiptViewById, hraRentPaid } from "@/lib/receipts";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, profile } = await getSessionProfile();

  if (!user || !profile?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const receipt = await fetchReceiptViewById(supabase, id);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const isAdmin = profile.role === "admin";
  const isOwner =
    profile.role === "tenant" && receipt.tenantProfileId === user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kind =
    new URL(request.url).searchParams.get("kind") === "hra" ? "hra" : "full";

  if (kind === "hra" && hraRentPaid(receipt) <= 0) {
    return NextResponse.json(
      { error: "This payment has no house-rent amount for HRA." },
      { status: 400 }
    );
  }

  const pdf = await renderReceiptPdfBuffer(receipt, kind);
  const fileName = receiptPdfFileName(receipt, kind);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
