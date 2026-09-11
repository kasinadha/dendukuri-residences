"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRentRemindedAction, sendAllUnpaidWhatsAppRemindersAction, sendWhatsAppReminderAction } from "@/app/admin/ops-actions";
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
  const [bulkMessage, setBulkMessage] = useState("");

  const sendableCount = rows.filter((row) => row.phone).length;

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

  function sendAll() {
    if (sendableCount === 0) return;
    if (
      !window.confirm(
        whatsappApiEnabled
          ? `Send WhatsApp reminders to ${sendableCount} tenant${
              sendableCount === 1 ? "" : "s"
            } with outstanding dues?`
          : `Open WhatsApp drafts for ${sendableCount} tenant${
              sendableCount === 1 ? "" : "s"
            } with outstanding dues? Allow pop-ups if the browser asks, and stay logged into WhatsApp Web.`
      )
    ) {
      return;
    }
    setError("");
    setBulkMessage("");
    setPendingId("all");

    if (!whatsappApiEnabled) {
      const draftRows = rows.filter((row) => row.whatsappUrl);
      startTransition(async () => {
        let opened = 0;
        for (const row of draftRows) {
          if (!row.whatsappUrl) continue;
          window.open(row.whatsappUrl, "_blank", "noopener,noreferrer");
          opened += 1;
          const formData = new FormData();
          formData.set("tenancy_id", row.tenancyId);
          formData.set("billing_month", billingMonthKey);
          formData.set("channel", "whatsapp");
          await markRentRemindedAction(formData);
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        setPendingId(null);
        const skipped = rows.length - draftRows.length;
        setBulkMessage(
          `Opened ${opened} WhatsApp draft${opened === 1 ? "" : "s"}.${
            skipped > 0 ? ` Skipped ${skipped} without a mobile number.` : ""
          }`
        );
        router.refresh();
      });
      return;
    }

    const formData = new FormData();
    formData.set("billing_month", billingMonthKey);
    startTransition(async () => {
      const result = await sendAllUnpaidWhatsAppRemindersAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError("error" in result ? result.error : "Could not send reminders.");
        return;
      }
      const failNote =
        result.failed.length > 0
          ? ` ${result.failed.length} failed.`
          : "";
      setBulkMessage(
        `Sent ${result.sent}. Skipped ${result.skipped} without a mobile number.${failNote}`
      );
      if (result.failed[0]) setError(result.failed[0].error);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Monthly dues unpaid · {billingMonthLabel}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Rent plus maintenance, parking, washer, other monthly charges, fines,
              and electricity. Move-in month has no dues; vacating tenants appear for
              their final month only (set vacate date to close the account).
            </p>
          </div>
          {rows.length > 0 ? (
            <button
              type="button"
              disabled={pending || sendableCount === 0}
              onClick={sendAll}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending && pendingId === "all"
                ? whatsappApiEnabled
                  ? "Sending…"
                  : "Opening…"
                : `Send reminders (${sendableCount})`}
            </button>
          ) : null}
        </div>
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
          )}{" "}
          Daily automatic send is 9:00 AM IST when Cloud API and approved message templates are configured.
        </p>
      </div>

      {bulkMessage ? (
        <p className="mx-5 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-6">
          {bulkMessage}
        </p>
      ) : null}

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
                      {row.chargesDue > 0 || row.electricityCharge > 0 ? (
                        <>
                          {row.maintenanceCharge > 0
                            ? ` · maint ${formatInr(row.maintenanceCharge)}`
                            : ""}
                          {row.carParkingCharge > 0
                            ? ` · park ${formatInr(row.carParkingCharge)}`
                            : ""}
                          {row.washingMachineCharge > 0
                            ? ` · washer ${formatInr(row.washingMachineCharge)}`
                            : ""}
                          {row.otherMonthlyCharge > 0
                            ? ` · other ${formatInr(row.otherMonthlyCharge)}`
                            : ""}
                          {row.finesCharge > 0
                            ? ` · fines ${formatInr(row.finesCharge)}`
                            : ""}
                          {row.electricityCharge > 0
                            ? ` · electricity ${formatInr(row.electricityCharge)}`
                            : ""}
                        </>
                      ) : null}
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
