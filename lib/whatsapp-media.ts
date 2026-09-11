import { createAdminClient } from "@/lib/supabase/admin";

/** Private bucket — providers fetch receipt PDFs via signed URLs (Twilio MediaUrl / Meta document.link). */
export const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";
export const WHATSAPP_MEDIA_SIGNED_URL_SECONDS = 60 * 60;

export async function uploadWhatsAppMediaAndSign(input: {
  bytes: Buffer | Uint8Array;
  path: string;
  contentType: string;
  expiresIn?: number;
}): Promise<
  { ok: true; path: string; signedUrl: string } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  if (!admin.ok) return admin;

  const body = Buffer.isBuffer(input.bytes)
    ? input.bytes
    : Buffer.from(input.bytes);

  const { error: uploadError } = await admin.client.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(input.path, body, {
      cacheControl: "3600",
      contentType: input.contentType,
      upsert: true,
    });

  if (uploadError) {
    const missingBucket =
      uploadError.message.includes("Bucket not found") ||
      uploadError.message.toLowerCase().includes("not found");
    return {
      ok: false,
      error: missingBucket
        ? "WhatsApp media storage is not set up. Run supabase/migrations/20260912_tenant_whatsapp_twilio.sql."
        : uploadError.message,
    };
  }

  const expiresIn = input.expiresIn ?? WHATSAPP_MEDIA_SIGNED_URL_SECONDS;
  const { data, error: signError } = await admin.client.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .createSignedUrl(input.path, expiresIn);

  if (signError || !data?.signedUrl) {
    return {
      ok: false,
      error: signError?.message ?? "Could not create a signed URL for WhatsApp media.",
    };
  }

  return { ok: true, path: input.path, signedUrl: data.signedUrl };
}
