"use client";

import { useState } from "react";
import { receiptPdfFileName } from "@/lib/receipt-pdf";
import type { ReceiptViewModel } from "@/lib/receipts";
import { downloadPdfBlob, fetchReceiptPdfBlob } from "@/lib/receipt-share";

export default function PrintReceiptButton({
  receipt,
}: {
  receipt: ReceiptViewModel;
}) {
  const [pending, setPending] = useState(false);

  async function handleDownloadPdf() {
    setPending(true);
    try {
      const blob = await fetchReceiptPdfBlob(receipt.receiptId);
      downloadPdfBlob(blob, receiptPdfFileName(receipt));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void handleDownloadPdf()}
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Preparing PDF…" : "Download PDF"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Print
      </button>
    </div>
  );
}
