import type { ReceiptViewModel } from "@/lib/receipts";
import { receiptPdfFileName } from "@/lib/receipt-pdf";

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchReceiptPdfBlob(
  receiptId: string,
  kind: "full" | "hra" = "full"
): Promise<Blob> {
  const suffix = kind === "hra" ? "?kind=hra" : "";
  const response = await fetch(`/api/receipts/${receiptId}/pdf${suffix}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message.trim() || "Could not generate the receipt PDF. Try again."
    );
  }
  return response.blob();
}

export async function buildReceiptPdfFile(
  receipt: ReceiptViewModel
): Promise<File> {
  const blob = await fetchReceiptPdfBlob(receipt.receiptId);
  return new File([blob], receiptPdfFileName(receipt), {
    type: "application/pdf",
  });
}
