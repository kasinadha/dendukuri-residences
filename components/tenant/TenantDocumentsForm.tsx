"use client";

import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { tenantUploadDocumentAction } from "@/app/tenant/actions";
import { formatActionError } from "@/lib/format-action-error";
import {
  documentKindLabel,
  governmentIdSubtypeLabel,
  type TenantDocument,
  type TenantDocumentKind,
} from "@/lib/tenant-documents";

function DocumentPreview({ doc }: { doc: TenantDocument | undefined }) {
  if (!doc) {
    return <p className="text-sm text-slate-500">Not uploaded yet.</p>;
  }
  const label =
    doc.kind === "government_id"
      ? governmentIdSubtypeLabel(doc.idSubtype)
      : documentKindLabel(doc.kind);
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        {label}
        {doc.originalFilename ? ` · ${doc.originalFilename}` : ""}
      </p>
      {doc.signedUrl && doc.mimeType?.startsWith("image/") ? (
        // Signed storage URL; not a configured next/image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={doc.signedUrl}
          alt={label}
          className="max-h-48 rounded-xl border border-slate-200 object-contain"
        />
      ) : doc.signedUrl ? (
        <a
          href={doc.signedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-emerald-700 underline"
        >
          View uploaded file
        </a>
      ) : (
        <p className="text-sm text-slate-500">Uploaded. Ask admin if the preview does not open.</p>
      )}
    </div>
  );
}

function UploadCard({
  kind,
  title,
  hint,
  current,
  children,
}: {
  kind: TenantDocumentKind;
  title: string;
  hint: string;
  current: TenantDocument | undefined;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const result = await tenantUploadDocumentAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Saved.");
        form.reset();
        router.refresh();
      } catch (err) {
        setError(formatActionError(err, "Could not upload. Try again."));
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <input type="hidden" name="kind" value={kind} />
      <div className="mt-4">{children}</div>
      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current file
        </p>
        <div className="mt-2">
          <DocumentPreview doc={current} />
        </div>
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          {current ? "Replace file" : "Upload file"}
        </span>
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <span className="mt-1 block text-xs text-slate-500">
          JPEG, PNG, WebP, or PDF up to 8 MB.
        </span>
      </label>
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Uploading…" : current ? "Replace" : "Upload"}
      </button>
    </form>
  );
}

export default function TenantDocumentsForm({
  documents,
}: {
  documents: TenantDocument[];
}) {
  const byKind = new Map(documents.map((doc) => [doc.kind, doc]));

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <UploadCard
        kind="government_id"
        title="Government ID"
        hint="Aadhaar or PAN card. Only the owner can see this."
        current={byKind.get("government_id")}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            ID type
          </span>
          <select
            name="id_subtype"
            required
            defaultValue={byKind.get("government_id")?.idSubtype ?? "aadhaar"}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="aadhaar">Aadhaar</option>
            <option value="pan">PAN card</option>
            <option value="other">Other</option>
          </select>
        </label>
      </UploadCard>
      <UploadCard
        kind="employment_proof"
        title="Employment proof"
        hint="Offer letter, ID card, or recent payslip."
        current={byKind.get("employment_proof")}
      />
    </div>
  );
}
