"use server";

import { requireAdmin } from "@/lib/auth";
import { sendReceiptPdfViaWhatsApp } from "@/lib/receipt-whatsapp";
import { fetchReceiptViewById } from "@/lib/receipts";
import {
  getWhatsAppBusinessConfig,
  whatsappApiNotConfiguredError,
} from "@/lib/whatsapp";

export async function sendReceiptWhatsAppAction(
  receiptId: string
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  if (!getWhatsAppBusinessConfig().apiEnabled) {
    return { ok: false, error: whatsappApiNotConfiguredError() };
  }

  const id = receiptId.trim();
  if (!id) return { ok: false, error: "Receipt is required." };

  const receipt = await fetchReceiptViewById(supabase, id);
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (!receipt.tenantPhone) {
    return { ok: false, error: "Tenant has no mobile number on file." };
  }

  return sendReceiptPdfViaWhatsApp({
    toPhone: receipt.tenantPhone,
    receipt,
  });
}
