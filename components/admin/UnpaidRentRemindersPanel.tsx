"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRentRemindedAction, sendWhatsAppReminderAction } from "@/app/admin/ops-actions";
import { paymentStatusLabel } from "@/lib/payment-status";
import { formatInr } from "@/lib/receipts";
import type { UnpaidReminderRow } from "@/lib/reminders";
import { WHATSAPP_BUSINESS_PHONE_E164 } from "@/lib/whatsapp";

function statusBadgeClass(status: string) {
  switch (status) {
    case "partial":
      return "bg-amber-50 text-amber-900";
    case "overdue":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sky-50 text-sky-800";
  }
}

function formatRemindedAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function UnpaidRentRemindersPanel({
  billingMonthKey,
  billingMonthLabel,
  rows,
  whatsappBusinessPhone,
  whatsappApiEnabled,
}: {
  billingMonthKey: string;
  billingMonthLabel: string;
  rows: UnpaidReminderRow[];
  whatsappBusinessPhone: string;
  whatsappApiEnabled?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function markReminded(row: UnpaidReminderRow, channel: string) {
    setError("");
    setPendingId(row.tenancyId);
    const formData = new FormData();
    formData.set("tenancy_id", row.tenancyId);
    formData.set("billing_month", billingMonthKey);
    formData.set("channel", channel);
    startTransition(async () => {
      const result = await markRentRemindedAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function sendViaApi(row: UnpaidReminderRow) {
    setError("");
    setPendingId(row.tenancyId);
    const formData = new FormData();
    formData.set("tenancy_id", row.tenancyId);
    formData.set("billing_month", billingMonthKey);
    startTransition(async () => {
      const result = await sendWhatsAppReminderAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">
          Monthly dues unpaid · {billingMonthLabel}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Rent plus maintenance, parking, washer, and other monthly charges.
          {whatsappApiEnabled
            ? " Send directly from your business WhatsApp API, or open a draft in WhatsApp Web."
            : " Open WhatsApp with a pre-filled message, then mark reminded."}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Send from business WhatsApp{" "}
          <span className="font-semibold">{whatsappBusinessPhone}</span>
          {!whatsappApiEnabled ? (
            <>
              {" "}
              · Log into{" "}
              <a
                href="https://web.whatsapp.com/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                web.whatsapp.com
              </a>{" "}
              with{" "}
              <a
                href={`https://wa.me/${WHATSAPP_BUSINESS_PHONE_E164}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                this number
              </a>{" "}
              before opening a draft.
            </>
          ) : (
            " via API, or open a draft in WhatsApp Web."
          )}
        </p>
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="p-6 text-sm text-emerald-800">
          All active tenants are fully paid or waived for this month&apos;s dues.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const remindedLabel = formatRemindedAt(row.remindedAt);
            const busy = pending && pendingId === row.tenancyId;
            return (
              <li
                key={row.tenancyId}
                className="flex flex-col gap-3 px-5 py-4 sm:px-6"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Flat {row.flatNumber} · {row.tenantName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Outstanding {formatInr(row.outstanding)} of{" "}
                      {formatInr(row.totalDue)}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Rent {formatInr(row.rentDue)}
                      {row.chargesDue > 0
                        ? ` · charges ${formatInr(row.chargesDue)}`
                        : ""}
                      {row.maintenanceCharge > 0
                        ? ` (maint ${formatInr(row.maintenanceCharge)}`
                        : ""}
                      {row.carParkingCharge > 0
                        ? `${row.maintenanceCharge > 0 ? "," : " ("}park ${formatInr(row.carParkingCharge)}`
                        : ""}
                      {row.washingMachineCharge > 0
                        ? `, washer ${formatInr(row.washingMachineCharge)}`
                        : ""}
                      {row.otherMonthlyCharge > 0
                        ? `, other ${formatInr(row.otherMonthlyCharge)}`
                        : ""}
                      {row.chargesDue > 0 ? ")" : ""}
                    </p>
                    {remindedLabel ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Reminded {remindedLabel}
                        {row.reminderChannel
                          ? ` · ${row.reminderChannel}`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        Not reminded yet
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                      row.status
                    )}`}
                  >
                    {paymentStatusLabel(row.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {whatsappApiEnabled && row.phone ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => sendViaApi(row)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {busy ? "Sending…" : "Send from business WhatsApp"}
                    </button>
                  ) : null}
                  {row.whatsappUrl ? (
                    <a
                      href={row.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markReminded(row, "whatsapp")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
                    >
                      Open WhatsApp draft
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => markReminded(row, "manual")}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {busy
                      ? "Saving…"
                      : remindedLabel
                        ? "Remind again"
                        : "Mark reminded"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
