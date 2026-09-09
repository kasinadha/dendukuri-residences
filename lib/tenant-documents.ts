import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/money";
import {
  createSignedStorageUrl,
  DOCUMENT_MIME_TYPES,
  extForMime,
  MAX_DOCUMENT_BYTES,
  uploadStorageObject,
  validateUploadFile,
} from "@/lib/storage-uploads";

export const TENANT_DOCUMENTS_BUCKET = "tenant-documents";

export const TENANT_DOCUMENT_KINDS = [
  "government_id",
  "employment_proof",
] as const;

export type TenantDocumentKind = (typeof TENANT_DOCUMENT_KINDS)[number];

export const GOVERNMENT_ID_SUBTYPES = ["aadhaar", "pan", "other"] as const;
export type GovernmentIdSubtype = (typeof GOVERNMENT_ID_SUBTYPES)[number];

export type TenantDocument = {
  id: string;
  tenantId: string;
  kind: TenantDocumentKind;
  idSubtype: string | null;
  filePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  updatedAt: string;
  signedUrl: string | null;
};

function isKind(value: string): value is TenantDocumentKind {
  return TENANT_DOCUMENT_KINDS.includes(value as TenantDocumentKind);
}

export function parseDocumentKind(
  value: string
): TenantDocumentKind | null {
  const kind = value.trim();
  return isKind(kind) ? kind : null;
}

export function parseGovernmentIdSubtype(
  value: string
): GovernmentIdSubtype | null {
  const raw = value.trim().toLowerCase();
  if (raw === "aadhaar" || raw === "aadhar") return "aadhaar";
  if (raw === "pan") return "pan";
  if (raw === "other") return "other";
  return null;
}

export function documentKindLabel(kind: TenantDocumentKind): string {
  return kind === "government_id" ? "Government ID" : "Employment proof";
}

export function governmentIdSubtypeLabel(subtype: string | null): string {
  switch (subtype) {
    case "aadhaar":
      return "Aadhaar";
    case "pan":
      return "PAN card";
    case "other":
      return "Other ID";
    default:
      return "Government ID";
  }
}

function mapRow(row: {
  id: string;
  tenant_id: string;
  kind: string;
  id_subtype: string | null;
  file_path: string;
  original_filename: string | null;
  mime_type: string | null;
  updated_at: string;
}): TenantDocument | null {
  if (!isKind(row.kind)) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    idSubtype: row.id_subtype,
    filePath: row.file_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    updatedAt: row.updated_at,
    signedUrl: null,
  };
}

async function withSignedUrls(
  supabase: SupabaseClient,
  docs: TenantDocument[]
): Promise<TenantDocument[]> {
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      signedUrl: await createSignedStorageUrl(
        supabase,
        TENANT_DOCUMENTS_BUCKET,
        doc.filePath
      ),
    }))
  );
}

export async function listTenantDocuments(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantDocument[]> {
  const { data, error } = await supabase
    .from("tenant_documents")
    .select(
      "id,tenant_id,kind,id_subtype,file_path,original_filename,mime_type,updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("kind");
  if (error) {
    if (isMissingColumnError(error.message) || /tenant_documents/i.test(error.message)) {
      return [];
    }
    return [];
  }
  const docs = (data ?? [])
    .map((row) => mapRow(row))
    .filter((row): row is TenantDocument => row != null);
  return withSignedUrls(supabase, docs);
}

export async function listAllTenantDocuments(
  supabase: SupabaseClient
): Promise<TenantDocument[]> {
  const { data, error } = await supabase
    .from("tenant_documents")
    .select(
      "id,tenant_id,kind,id_subtype,file_path,original_filename,mime_type,updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingColumnError(error.message) || /tenant_documents/i.test(error.message)) {
      return [];
    }
    return [];
  }
  const docs = (data ?? [])
    .map((row) => mapRow(row))
    .filter((row): row is TenantDocument => row != null);
  return withSignedUrls(supabase, docs);
}

export async function upsertTenantDocument(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    profileId: string;
    kind: TenantDocumentKind;
    idSubtype?: string | null;
    file: File;
    uploadedBy: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateUploadFile(input.file, {
    allowed: DOCUMENT_MIME_TYPES,
    maxBytes: MAX_DOCUMENT_BYTES,
    emptyOk: false,
    imageLabel: "Upload a JPEG, PNG, WebP, HEIC, or PDF file.",
  });
  if (!validated.ok) return validated;
  if (!validated.file || !validated.mime) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const ext = extForMime(validated.mime);
  const path = `${input.profileId}/${input.kind}.${ext}`;

  const uploaded = await uploadStorageObject(supabase, {
    bucket: TENANT_DOCUMENTS_BUCKET,
    path,
    file: validated.file,
    contentType: validated.mime,
    upsert: true,
    missingHint:
      "Document storage is not set up. Ask the owner to run supabase/migrations/20260910_uploads_documents_cleanliness.sql in Supabase.",
  });
  if (!uploaded.ok) return uploaded;

  const payload = {
    tenant_id: input.tenantId,
    kind: input.kind,
    id_subtype:
      input.kind === "government_id" ? input.idSubtype?.trim() || null : null,
    file_path: uploaded.path,
    original_filename: validated.file.name || null,
    mime_type: validated.mime || null,
    uploaded_by: input.uploadedBy,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("tenant_documents")
    .upsert(payload, { onConflict: "tenant_id,kind" });

  if (error) {
    if (/tenant_documents/i.test(error.message) || isMissingColumnError(error.message)) {
      return {
        ok: false,
        error:
          "Document records are not set up yet. Ask the owner to run supabase/migrations/20260910_uploads_documents_cleanliness.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
