"use client";

import { useState } from "react";
import { receiptPdfFileName } from "@/lib/receipt-pdf";
import type { ReceiptViewModel } from "@/lib/receipts";
import { downloadPdfBlob, fetchReceiptPdfBlob } from "@/lib/receipt-share";

export default function DownloadHraButton({
  receipt,
}: {
  receipt: ReceiptViewModel;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const blob = await fetchReceiptPdfBlob(receipt.receiptId, "hra");
      downloadPdfBlob(blob, receiptPdfFileName(receipt, "hra"));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-60"
    >
      {pending ? "Preparing…" : "HRA PDF"}
    </button>
  );
}
