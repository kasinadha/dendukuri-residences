import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const DOCUMENT_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  "application/pdf",
]);

export function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

export function mimeOfFile(file: File): string {
  const typed = file.type.trim().toLowerCase();
  if (typed && typed !== "application/octet-stream") return typed;
  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return typed;
}

export function validateUploadFile(
  file: File | null | undefined,
  options: {
    allowed: Set<string>;
    maxBytes: number;
    emptyOk?: boolean;
    imageLabel?: string;
  }
):
  | { ok: true; file: File; mime: string }
  | { ok: true; file: null; mime: null }
  | { ok: false; error: string } {
  if (!file || file.size === 0) {
    if (options.emptyOk !== false) return { ok: true, file: null, mime: null };
    return { ok: false, error: "Choose a file to upload." };
  }
  const mime = mimeOfFile(file);
  if (!options.allowed.has(mime)) {
    return {
      ok: false,
      error:
        options.imageLabel ??
        "File must be a JPEG, PNG, WebP, HEIC image, or PDF.",
    };
  }
  if (file.size > options.maxBytes) {
    const mb = Math.round(options.maxBytes / (1024 * 1024));
    return { ok: false, error: `File must be ${mb} MB or smaller.` };
  }
  return { ok: true, file, mime };
}

export function validateImageFile(
  file: File | null | undefined,
  emptyOk = true
) {
  return validateUploadFile(file, {
    allowed: IMAGE_MIME_TYPES,
    maxBytes: MAX_IMAGE_BYTES,
    emptyOk,
    imageLabel: "Upload a JPEG, PNG, WebP, or HEIC image.",
  });
}

export async function uploadStorageObject(
  supabase: SupabaseClient,
  input: {
    bucket: string;
    path: string;
    file: File;
    contentType?: string;
    upsert?: boolean;
    missingHint: string;
  }
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(input.bucket).upload(
    input.path,
    input.file,
    {
      cacheControl: "3600",
      contentType: input.contentType || input.file.type || "application/octet-stream",
      upsert: input.upsert ?? false,
    }
  );
  if (error) {
    const msg = error.message ?? "";
    if (/bucket not found|not found/i.test(msg)) {
      return { ok: false, error: input.missingHint };
    }
    return { ok: false, error: msg };
  }
  return { ok: true, path: input.path };
}

export async function createSignedStorageUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
  expiresIn = 60 * 60
): Promise<string | null> {
  if (!path?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path.trim(), expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function asFormFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

export function asFormFiles(formData: FormData, key: string): File[] {
  return formData
    .getAll(key)
    .filter((item): item is File => item instanceof File && item.size > 0);
}
