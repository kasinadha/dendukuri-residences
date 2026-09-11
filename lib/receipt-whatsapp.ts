import { renderReceiptPdfBuffer, receiptPdfFileName } from "@/lib/receipt-pdf";
import { formatReceiptPdfShareMessage, type ReceiptViewModel } from "@/lib/receipts";
import { uploadWhatsAppMediaAndSign } from "@/lib/whatsapp-media";
import { sendWhatsAppBusinessMessage } from "@/lib/whatsapp";

export async function sendReceiptPdfViaWhatsApp(input: {
  toPhone: string;
  receipt: ReceiptViewModel;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const pdf = await renderReceiptPdfBuffer(input.receipt);
  const fileName = receiptPdfFileName(input.receipt);
  const path = `receipts/${input.receipt.receiptId}/${fileName}`;

  const uploaded = await uploadWhatsAppMediaAndSign({
    bytes: pdf,
    path,
    contentType: "application/pdf",
  });
  if (!uploaded.ok) return uploaded;

  return sendWhatsAppBusinessMessage({
    toPhone: input.toPhone,
    body: formatReceiptPdfShareMessage(input.receipt),
    mediaUrl: uploaded.signedUrl,
    mediaFileName: fileName,
  });
}
