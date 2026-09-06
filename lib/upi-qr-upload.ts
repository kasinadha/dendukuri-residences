import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extForMime,
  uploadStorageObject,
  validateImageFile,
} from "@/lib/storage-uploads";

export const UPI_QR_BUCKET = "upi-qr";

function publicUrlForPath(supabase: SupabaseClient, path: string): string {
  const { data } = supabase.storage.from(UPI_QR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadUpiQrImage(
  supabase: SupabaseClient,
  input: { objectKey: string; file: File }
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const validated = validateImageFile(input.file, false);
  if (!validated.ok) return validated;
  if (!validated.file || !validated.mime) {
    return { ok: false, error: "Choose a QR image to upload." };
  }

  const ext = extForMime(validated.mime);
  const path = `${input.objectKey.replace(/^\/+|\/+$/g, "")}.${ext}`;
  const uploaded = await uploadStorageObject(supabase, {
    bucket: UPI_QR_BUCKET,
    path,
    file: validated.file,
    contentType: validated.mime,
    upsert: true,
    missingHint:
      "QR image storage is not set up. Run supabase/migrations/20260910_uploads_documents_cleanliness.sql in Supabase.",
  });
  if (!uploaded.ok) return uploaded;
  return { ok: true, url: publicUrlForPath(supabase, uploaded.path) };
}

export async function resolveQrUrlFromForm(
  supabase: SupabaseClient,
  formData: FormData,
  input: { fileKey: string; urlKey: string; objectKey: string }
): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const file = formData.get(input.fileKey);
  const typed = file instanceof File ? file : null;
  if (typed && typed.size > 0) {
    return uploadUpiQrImage(supabase, {
      objectKey: input.objectKey,
      file: typed,
    });
  }
  const urlValue = formData.get(input.urlKey);
  const url = typeof urlValue === "string" ? urlValue.trim() : "";
  return { ok: true, url: url || null };
}
