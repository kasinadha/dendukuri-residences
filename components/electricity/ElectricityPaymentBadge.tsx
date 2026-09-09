import type { ElectricityPaymentStatus } from "@/lib/electricity-dues";
import { formatInr } from "@/lib/receipts";

const styles: Record<ElectricityPaymentStatus["label"], string> = {
  Paid: "bg-emerald-100 text-emerald-800",
  Partial: "bg-amber-100 text-amber-900",
  Unpaid: "bg-red-100 text-red-800",
};

export default function ElectricityPaymentBadge({
  status,
  compact,
}: {
  status: ElectricityPaymentStatus;
  compact?: boolean;
}) {
  return (
    <div className="text-left sm:text-right">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status.label]}`}
      >
        {status.label}
      </span>
      {!compact ? (
        <p className="mt-1 text-xs text-slate-500">
          Due {formatInr(status.due)} · Paid {formatInr(status.paid)} · Owes{" "}
          {formatInr(status.outstanding)}
        </p>
      ) : null}
    </div>
  );
}
