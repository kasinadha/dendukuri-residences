"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveTenancyAgreementAction,
  generateDraftAgreementsAction,
  markAgreementRemindedAction,
  publishAgreementTemplateAction,
  recordWasteFineAction,
  sendAgreementWhatsAppReminderAction,
} from "@/app/admin/agreements/actions";
import type { AgreementTemplate, TenancyAgreement } from "@/lib/agreements";
import { DEFAULT_AGREEMENT_BODY, DEFAULT_AGREEMENT_TITLE } from "@/lib/agreements";
import { formatDisplayDate, formatInr } from "@/lib/receipts";
import type { TenantFine } from "@/lib/fines";

function statusLabel(row: TenancyAgreement): string {
  if (row.adminStatus === "draft") return "Needs your approval";
  if (row.tenantStatus === "accepted") return "Tenant accepted";
  return "Waiting on tenant";
}

export default function AdminAgreementsClient({
  template,
  templates,
  agreements,
  fines,
  fineOptions,
  whatsappApiEnabled,
}: {
  template: AgreementTemplate | null;
  templates: AgreementTemplate[];
  agreements: TenancyAgreement[];
  fines: TenantFine[];
  fineOptions: Array<{ tenancyId: string; label: string }>;
  whatsappApiEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingApproval = agreements.filter((row) => row.adminStatus === "draft");
  const waitingTenant = agreements.filter(
    (row) => row.adminStatus === "approved" && row.tenantStatus !== "accepted"
  );

  function run(
    id: string | null,
    work: () => Promise<{ ok: boolean; error?: string; message?: string }>
  ) {
    setError("");
    setSuccess("");
    setBusyId(id);
    startTransition(async () => {
      const result = await work();
      setBusyId(null);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (result.message) setSuccess(result.message);
      router.refresh();
    });
  }

  function onPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run("publish", async () => {
      const result = await publishAgreementTemplateAction(formData);
      if (!result.ok) return result;
      return {
        ok: true,
        message: "Published. New drafts were created for occupied flats — approve each flat.",
      };
    });
  }

  function onFine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run("fine", async () => {
      const result = await recordWasteFineAction(formData);
      if (!result.ok) return result;
      return {
        ok: true,
        message: `Fine ₹${result.amount} (offence ${result.offenseNumber}) added to this month's dues.`,
      };
    });
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">House rules template</h3>
            <p className="mt-1 text-sm text-slate-500">
              {template
                ? `Current version ${template.version}. Publishing a new version creates draft agreements for every occupied flat.`
                : "No template yet. Publish the default Bangalore terms below."}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("generate", async () => {
                const result = await generateDraftAgreementsAction();
                if (!result.ok) return result;
                return {
                  ok: true,
                  message: `Created ${result.created} draft${result.created === 1 ? "" : "s"}; ${result.skipped} already current.`,
                };
              })
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            Refresh drafts
          </button>
        </div>
        <form onSubmit={onPublish} className="mt-4 grid gap-3">
          <input
            name="title"
            defaultValue={template?.title ?? DEFAULT_AGREEMENT_TITLE}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <textarea
            name="body"
            rows={12}
            defaultValue={template?.body ?? DEFAULT_AGREEMENT_BODY}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={pending && busyId === "publish"}
            className="w-fit rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending && busyId === "publish" ? "Publishing…" : "Publish new version"}
          </button>
        </form>
        {templates.length > 1 ? (
          <p className="mt-3 text-xs text-slate-500">
            Earlier versions: {templates.filter((row) => !row.isCurrent).map((row) => `v${row.version}`).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Per-flat agreements</h3>
          <p className="mt-1 text-sm text-slate-500">
            Approve each flat before the tenant can see and accept it.
            {pendingApproval.length ? ` ${pendingApproval.length} need approval.` : ""}
            {waitingTenant.length ? ` ${waitingTenant.length} waiting on tenants.` : ""}
            {" "}Approved terms that tenants have not accepted are reminded daily at 9:00 AM IST when Cloud API is configured.
          </p>
        </div>
        {agreements.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No agreements yet. Publish terms, then refresh drafts.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {agreements.map((row) => {
              const busy = pending && busyId === row.id;
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Flat {row.flatNumber} · {row.tenantName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Move-in{" "}
                        {row.moveInDate
                          ? formatDisplayDate(row.moveInDate)
                          : "not recorded"}{" "}
                        · rent {formatInr(row.monthlyRent)} · maint{" "}
                        {formatInr(row.maintenanceCharge)} · deposit paid{" "}
                        {formatInr(row.depositPaid)}
                        {row.templateVersion ? ` · terms v${row.templateVersion}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {statusLabel(row)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.adminStatus === "draft" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(row.id, async () => {
                              const formData = new FormData();
                              formData.set("id", row.id);
                              return approveTenancyAgreementAction(formData);
                            })
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "Saving…" : "Approve for tenant"}
                        </button>
                      ) : null}
                      {row.adminStatus === "approved" &&
                      row.tenantStatus !== "accepted" ? (
                        <>
                          {whatsappApiEnabled && row.phone ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(row.id, async () => {
                                  const formData = new FormData();
                                  formData.set("id", row.id);
                                  formData.set("tenancy_id", row.tenancyId);
                                  return sendAgreementWhatsAppReminderAction(formData);
                                })
                              }
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {busy ? "Sending…" : "Remind on WhatsApp"}
                            </button>
                          ) : null}
                          {row.whatsappUrl ? (
                            <a
                              href={row.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                run(row.id, async () => {
                                  const formData = new FormData();
                                  formData.set("id", row.id);
                                  formData.set("tenancy_id", row.tenancyId);
                                  formData.set("channel", "whatsapp");
                                  return markAgreementRemindedAction(formData);
                                })
                              }
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
                            >
                              Open WhatsApp draft
                            </a>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(row.id, async () => {
                                const formData = new FormData();
                                formData.set("id", row.id);
                                formData.set("tenancy_id", row.tenancyId);
                                formData.set("channel", "manual");
                                return markAgreementRemindedAction(formData);
                              })
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                          >
                            Mark reminded
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Waste-dumping fine</h3>
        <p className="mt-1 text-sm text-slate-500">
          First ₹500, then ₹750, ₹1000, then +₹250. The amount is added to this
          month&apos;s dues automatically.
        </p>
        <form onSubmit={onFine} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select
            name="tenancy_id"
            required
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">Select flat / tenant</option>
            {fineOptions.map((row) => (
              <option key={row.tenancyId} value={row.tenancyId}>
                {row.label}
              </option>
            ))}
          </select>
          <input
            name="notes"
            placeholder="Optional note"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={pending && busyId === "fine"}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending && busyId === "fine" ? "Saving…" : "Add fine"}
          </button>
        </form>
        {fines.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {fines.slice(0, 12).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>
                  Flat {row.flatNumber} · {row.tenantName} · offence{" "}
                  {row.offenseNumber}
                </span>
                <span className="font-semibold">
                  {formatInr(row.amount)} · {row.billingMonth}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
