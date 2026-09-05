"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidPaymentAction } from "@/app/admin/payments/actions";

type Props = {
  paymentId: string;
  flatNumber: string;
  tenantName: string;
  billingMonthLabel: string;
  amountPaidLabel: string;
  receiptNumber?: string | null;
};

export default function PaymentVoidButton({
  paymentId,
  flatNumber,
  tenantName,
  billingMonthLabel,
  amountPaidLabel,
  receiptNumber,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleVoid() {
    setError("");
    const summary = [
      `Flat ${flatNumber} · ${tenantName}`,
      `${billingMonthLabel} · ${amountPaidLabel}`,
      receiptNumber ? `Receipt ${receiptNumber}` : "No receipt",
    ].join("\n");

    const confirmed = window.confirm(
      `Void this payment?\n\n${summary}\n\nThe payment and receipt stay in history as voided. Dues will recalculate, and a deposit/advance will reverse deposit paid. Type VOID in the next prompt to confirm.`
    );
    if (!confirmed) return;

    const typed = window.prompt("Type VOID to confirm:");
    if (typed?.trim().toUpperCase() !== "VOID") {
      setError("Cancelled — type VOID exactly to confirm.");
      return;
    }

    const formData = new FormData();
    formData.set("payment_id", paymentId);
    formData.set("confirm", "VOID");

    startTransition(async () => {
      try {
        const result = await voidPaymentAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not void this payment."
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleVoid}
        className="text-sm font-semibold text-red-700 disabled:opacity-60"
      >
        {pending ? "Voiding…" : "Void payment"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
