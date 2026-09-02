"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reclassifyPaymentAsDepositAction } from "@/app/admin/payments/actions";

type Props = {
  paymentId: string;
  flatNumber: string;
  amountPaidLabel: string;
};

export default function ReclassifyDepositButton({
  paymentId,
  flatNumber,
  amountPaidLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    const ok = window.confirm(
      `Reclassify Flat ${flatNumber} payment ${amountPaidLabel} as deposit?\n\nThis removes it from monthly dues collected and adds it to deposit tracking.`
    );
    if (!ok) return;

    setError("");
    startTransition(async () => {
      const result = await reclassifyPaymentAsDepositAction(paymentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-sm font-semibold text-violet-700 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Mark as deposit"}
      </button>
      {error ? (
        <span className="max-w-xs text-right text-xs text-red-600">{error}</span>
      ) : null}
    </span>
  );
}
