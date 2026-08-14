import Link from "next/link";
import PrintReceiptButton from "@/components/receipts/PrintReceiptButton";
import type { ReceiptViewModel } from "@/lib/receipts";
import { formatDisplayDate, formatInr } from "@/lib/receipts";

type Props = {
  receipt: ReceiptViewModel;
  viewer: "admin" | "tenant";
};

function methodLabel(value: string): string {
  const map: Record<string, string> = {
    upi: "UPI",
    bank_transfer: "Bank transfer",
    cash: "Cash",
    cheque: "Cheque",
    card: "Card",
  };
  return map[value] ?? value;
}

export default function ReceiptDocument({ receipt, viewer }: Props) {
  const backHref =
    viewer === "admin" ? "/admin/payments" : "/tenant/receipts";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={backHref}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-600"
        >
          ← Back
        </Link>
        <PrintReceiptButton />
      </div>

      <article className="receipt-sheet rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Rent receipt
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
            {receipt.propertyName}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Receipt no.{" "}
            <span className="font-semibold text-slate-800">
              {receipt.receiptNumber}
            </span>
          </p>
        </header>

        <dl className="mt-8 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tenant name
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {receipt.tenantName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Flat number
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {receipt.flatNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billing month
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {receipt.billingMonth}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rent amount
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {formatInr(receipt.rentAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment date
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {formatDisplayDate(receipt.paymentDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment method
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {methodLabel(receipt.paymentMethod)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Transaction reference
            </dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">
              {receipt.transactionReference}
            </dd>
          </div>
        </dl>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
          Issued {formatDisplayDate(receipt.createdAt)}. This receipt confirms
          rent received for {receipt.propertyName}.
        </footer>
      </article>
    </div>
  );
}
