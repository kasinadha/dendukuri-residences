"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEnquiryFollowupAction,
  updateEnquiryStatusAction,
} from "@/app/admin/enquiries/actions";
import {
  ENQUIRY_STATUSES,
  type Enquiry,
  type EnquiryFollowup,
  type EnquiryStatus,
} from "@/lib/enquiries";

function statusLabel(status: EnquiryStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "visit_planned":
      return "Visit planned";
    case "interested":
      return "Interested";
    case "not_looking":
      return "Not looking";
    case "converted":
      return "Converted";
    default:
      return status;
  }
}

export default function AdminEnquiriesClient({
  enquiries,
  selected,
  followups,
}: {
  enquiries: Enquiry[];
  selected: Enquiry | null;
  followups: EnquiryFollowup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("id", selected.id);
    startTransition(async () => {
      const result = await updateEnquiryStatusAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("enquiry_id", selected.id);
    startTransition(async () => {
      const result = await addEnquiryFollowupAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Pipeline</h3>
          <p className="mt-1 text-sm text-slate-500">
            Overdue follow-ups are highlighted. Close when they say they are not
            looking.
          </p>
        </div>
        {enquiries.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No enquiries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {enquiries.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/enquiries?id=${row.id}`}
                  className={`block px-5 py-4 ${
                    row.id === selected?.id ? "bg-emerald-50" : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{row.fullName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.phone}
                    {row.bhkPreference ? ` · ${row.bhkPreference}` : ""}
                    {row.moveInMonth ? ` · ${row.moveInMonth}` : ""}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      row.overdue ? "text-amber-800" : "text-slate-600"
                    }`}
                  >
                    {statusLabel(row.status)}
                    {row.overdue ? " · follow-up due" : ""}
                    {row.nextFollowUpOn ? ` · next ${row.nextFollowUpOn}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {selected ? (
          <>
            <h3 className="text-lg font-bold text-slate-900">{selected.fullName}</h3>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>Phone: {selected.phone}</p>
              <p>BHK: {selected.bhkPreference || "—"}</p>
              <p>Move-in: {selected.moveInMonth || "—"}</p>
              <p>Budget: {selected.budgetRange || "—"}</p>
              <p>Occupants: {selected.occupants || "—"}</p>
              <p>Parking: {selected.parkingNeed || "—"}</p>
              <p className="sm:col-span-2">
                Heard from: {selected.heardFrom || "—"}
              </p>
              <p className="sm:col-span-2">Notes: {selected.notes || "—"}</p>
            </dl>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {selected.whatsappUrl ? (
              <a
                href={selected.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Open WhatsApp
              </a>
            ) : null}
            <form
              onSubmit={onStatus}
              className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <select
                name="status"
                defaultValue={selected.status}
                key={`${selected.id}-status`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {ENQUIRY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="next_follow_up_on"
                defaultValue={selected.nextFollowUpOn ?? ""}
                key={`${selected.id}-date`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Save status
              </button>
            </form>
            <form onSubmit={onFollowup} className="mt-4 grid gap-3">
              <textarea
                name="body"
                required
                rows={3}
                placeholder="What did they say? Next step?"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Log follow-up
              </button>
            </form>
            {followups.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No follow-ups logged yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {followups.map((row) => (
                  <li key={row.id} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p>{row.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.channel} ·{" "}
                      {new Date(row.createdAt).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">Select an enquiry.</p>
        )}
      </section>
    </div>
  );
}
