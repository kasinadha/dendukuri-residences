import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_PROOF_MIME,
  MAX_PROOF_BYTES,
  PAYMENT_PROOFS_BUCKET,
} from "@/lib/payment-proofs";

export const FLAT_QR_STORAGE_PREFIX = "flat-qr/";

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

export function isFlatQrStoragePath(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith(FLAT_QR_STORAGE_PREFIX));
}

export function validateFlatQrFile(
  file: File | null | undefined
): { ok: true; file: File } | { ok: false; error: string } {
  if (!file || file.size === 0) {
    return { ok: false, error: "Choose a QR image to upload." };
  }
  if (!ALLOWED_PROOF_MIME.has(file.type)) {
    return {
      ok: false,
      error: "QR image must be JPEG, PNG, WebP, or HEIC.",
    };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return { ok: false, error: "QR image must be 5 MB or smaller." };
  }
  return { ok: true, file };
}

export async function uploadFlatQrImage(
  supabase: SupabaseClient,
  input: { flatId: string; file: File }
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validated = validateFlatQrFile(input.file);
  if (!validated.ok) return validated;

  const ext = extForMime(validated.file.type);
  const path = `${FLAT_QR_STORAGE_PREFIX}${input.flatId}/qr-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(path, validated.file, {
      cacheControl: "31536000",
      contentType: validated.file.type,
      upsert: true,
    });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("Bucket not found")
        ? "QR storage is not set up. Run the flat QR storage migration in Supabase."
        : error.message,
    };
  }

  return { ok: true, path };
}

export async function resolveFlatQrDisplayUrl(
  supabase: SupabaseClient,
  upiQrUrl: string | null | undefined,
  expiresIn = 60 * 60 * 24 * 7
): Promise<string | null> {
  const raw = upiQrUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
    return raw;
  }
  if (!isFlatQrStoragePath(raw)) return raw;

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(raw, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
