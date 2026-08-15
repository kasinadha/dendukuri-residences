import type { SupabaseClient } from "@supabase/supabase-js";

export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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

export function validatePaymentProofFile(
  file: File | null | undefined
): { ok: true; file: File } | { ok: false; error: string } | { ok: true; file: null } {
  if (!file || file.size === 0) return { ok: true, file: null };
  if (!ALLOWED_PROOF_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Proof must be a JPEG, PNG, WebP, or HEIC image.",
    };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return { ok: false, error: "Proof image must be 5 MB or smaller." };
  }
  return { ok: true, file };
}

/**
 * Uploads a tenant payment screenshot to private Storage.
 * Path: `{userId}/{timestamp}-{random}.{ext}`
 */
async function uploadProofToPath(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("Bucket not found") ||
        error.message.toLowerCase().includes("not found")
          ? "Payment proof storage is not set up. Ask admin to run the payment-proofs migration."
          : error.message,
    };
  }

  return { ok: true, path };
}

export async function uploadPaymentProof(
  supabase: SupabaseClient,
  input: { userId: string; file: File }
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validated = validatePaymentProofFile(input.file);
  if (!validated.ok) return validated;
  if (!validated.file) {
    return { ok: false, error: "No proof file provided." };
  }

  const ext = extForMime(validated.file.type);
  const path = `${input.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  return uploadProofToPath(supabase, path, validated.file);
}

/** Anon/public pay claims: path must start with `public-claims/` (RLS). */
export async function uploadPublicPaymentProof(
  supabase: SupabaseClient,
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validated = validatePaymentProofFile(file);
  if (!validated.ok) return validated;
  if (!validated.file) {
    return { ok: false, error: "No proof file provided." };
  }

  const ext = extForMime(validated.file.type);
  const path = `public-claims/${crypto.randomUUID()}/${Date.now()}.${ext}`;
  return uploadProofToPath(supabase, path, validated.file);
}

export async function createPaymentProofSignedUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
  expiresIn = 60 * 60
): Promise<string | null> {
  if (!path?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path.trim(), expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function mapProofPathsToSignedUrls(
  supabase: SupabaseClient,
  paths: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      paths
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p))
    ),
  ];
  const out = new Map<string, string>();
  await Promise.all(
    unique.map(async (path) => {
      const url = await createPaymentProofSignedUrl(supabase, path);
      if (url) out.set(path, url);
    })
  );
  return out;
}
