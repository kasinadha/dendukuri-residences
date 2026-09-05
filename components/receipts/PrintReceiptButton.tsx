"use client";

import { useState } from "react";
import { receiptPdfFileName } from "@/lib/receipt-pdf";
import { hraRentPaid, type ReceiptViewModel } from "@/lib/receipts";
import { downloadPdfBlob, fetchReceiptPdfBlob } from "@/lib/receipt-share";

export default function PrintReceiptButton({
  receipt,
}: {
  receipt: ReceiptViewModel;
}) {
  const [pending, setPending] = useState<"full" | "hra" | null>(null);
  const hraAmount = hraRentPaid(receipt);

  async function handleDownloadPdf(kind: "full" | "hra") {
    setPending(kind);
    try {
      const blob = await fetchReceiptPdfBlob(receipt.receiptId, kind);
      downloadPdfBlob(blob, receiptPdfFileName(receipt, kind));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void handleDownloadPdf("full")}
        disabled={pending != null}
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending === "full" ? "Preparing PDF…" : "Download PDF"}
      </button>
      {hraAmount > 0 ? (
        <button
          type="button"
          onClick={() => void handleDownloadPdf("hra")}
          disabled={pending != null}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
        >
          {pending === "hra" ? "Preparing HRA…" : "Download HRA PDF"}
        </button>
      ) : null}
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
