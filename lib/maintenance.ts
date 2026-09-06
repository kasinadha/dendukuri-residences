import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/money";
import {
  createSignedStorageUrl,
  extForMime,
  isVideoMime,
  MAX_MAINTENANCE_MEDIA,
  MAX_MAINTENANCE_VIDEOS,
  mimeOfFile,
  uploadStorageObject,
  validateMaintenanceMediaFile,
} from "@/lib/storage-uploads";

export const MAINTENANCE_PHOTOS_BUCKET = "maintenance-photos";
export const MAX_MAINTENANCE_PHOTOS = MAX_MAINTENANCE_MEDIA;

export type MaintenanceRequest = {
  id: string;
  flatId: string;
  flatNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  cost: number | null;
  category: string | null;
  payerAccountId: string | null;
  payerAccountLabel: string | null;
  createdAt: string;
  photoPaths: string[];
  photoUrls: string[];
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export async function uploadMaintenancePhotos(
  supabase: SupabaseClient,
  input: { userId: string; files: File[] }
): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  if (input.files.length > MAX_MAINTENANCE_MEDIA) {
    return {
      ok: false,
      error: `Upload up to ${MAX_MAINTENANCE_MEDIA} photos or videos.`,
    };
  }

  const videoCount = input.files.filter((file) =>
    isVideoMime(mimeOfFile(file))
  ).length;
  if (videoCount > MAX_MAINTENANCE_VIDEOS) {
    return {
      ok: false,
      error: `Upload up to ${MAX_MAINTENANCE_VIDEOS} videos.`,
    };
  }

  const paths: string[] = [];
  for (const [index, file] of input.files.entries()) {
    const validated = validateMaintenanceMediaFile(file, false);
    if (!validated.ok) return validated;
    if (!validated.file || !validated.mime) continue;
    const ext = extForMime(validated.mime);
    const path = `${input.userId}/${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const uploaded = await uploadStorageObject(supabase, {
      bucket: MAINTENANCE_PHOTOS_BUCKET,
      path,
      file: validated.file,
      contentType: validated.mime,
      upsert: false,
      missingHint:
        "Photo/video storage is not set up. Ask the owner to run supabase/migrations/20260910_uploads_documents_cleanliness.sql and 20260911_maintenance_videos.sql in Supabase.",
    });
    if (!uploaded.ok) return uploaded;
    paths.push(uploaded.path);
  }
  return { ok: true, paths };
}

async function signPhotoPaths(
  supabase: SupabaseClient,
  paths: string[]
): Promise<string[]> {
  const urls = await Promise.all(
    paths.map((path) =>
      createSignedStorageUrl(supabase, MAINTENANCE_PHOTOS_BUCKET, path)
    )
  );
  return urls.filter((url): url is string => Boolean(url));
}

export async function listMaintenanceRequests(
  supabase: SupabaseClient,
  options?: { flatId?: string; limit?: number }
): Promise<MaintenanceRequest[]> {
  const base = `
      id,
      flat_id,
      title,
      description,
      status,
      priority,
      cost,
      category,
      payer_account_id,
      created_at,
      flats ( flat_number )
  `;
  const withPhotos = `${base}, photo_paths`;
  const withPayer = `${withPhotos}, payment_accounts ( label )`;
  const withPayerNoPhotos = `${base}, payment_accounts ( label )`;

  async function run(select: string) {
    let query = supabase
      .from("maintenance_requests")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.flatId) {
      query = query.eq("flat_id", options.flatId);
    }
    return query;
  }

  let { data, error } = await run(withPayer);
  if (error && (isMissingColumnError(error.message) || /photo_paths/i.test(error.message))) {
    const retry = await run(withPayerNoPhotos);
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    const retry = await run(base);
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) return [];

  const mapped = data.map((row) => {
    const rec = row as unknown as {
      id: string;
      flat_id: string;
      title: string | null;
      description: string | null;
      status: string | null;
      priority: string | null;
      cost: unknown;
      category: string | null;
      payer_account_id: string | null;
      created_at: string;
      photo_paths?: unknown;
      flats?: { flat_number?: string } | { flat_number?: string }[] | null;
      payment_accounts?: { label?: string } | { label?: string }[] | null;
    };
    const flat = Array.isArray(rec.flats) ? rec.flats[0] : rec.flats;
    const payerAccount = Array.isArray(rec.payment_accounts)
      ? rec.payment_accounts[0]
      : rec.payment_accounts;
    return {
      id: rec.id,
      flatId: rec.flat_id,
      flatNumber: flat?.flat_number?.trim() || "—",
      title: rec.title?.trim() || "—",
      description: rec.description,
      status: rec.status?.trim() || "open",
      priority: rec.priority?.trim() || "normal",
      cost: num(rec.cost),
      category: rec.category,
      payerAccountId: rec.payer_account_id,
      payerAccountLabel: payerAccount?.label?.trim() || null,
      createdAt: rec.created_at,
      photoPaths: asStringArray(rec.photo_paths),
      photoUrls: [] as string[],
    };
  });

  return Promise.all(
    mapped.map(async (row) => ({
      ...row,
      photoUrls: await signPhotoPaths(supabase, row.photoPaths),
    }))
  );
}

export async function createMaintenanceRequest(
  supabase: SupabaseClient,
  input: {
    flatId: string;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    cost?: number | null;
    category?: string | null;
    payerAccountId?: string | null;
    photoPaths?: string[];
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.flatId) return { ok: false, error: "Select a flat." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (
    input.payerAccountId !== undefined &&
    !input.payerAccountId?.trim()
  ) {
    return { ok: false, error: "Select who paid for this expense." };
  }

  const payload: Record<string, unknown> = {
    flat_id: input.flatId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status?.trim() || "open",
    priority: input.priority?.trim() || "normal",
    cost: input.cost ?? null,
    category: input.category?.trim() || null,
  };
  if (input.payerAccountId !== undefined) {
    payload.payer_account_id = input.payerAccountId?.trim() || null;
  }
  if (input.photoPaths && input.photoPaths.length > 0) {
    payload.photo_paths = input.photoPaths;
  }

  let { data, error } = await supabase
    .from("maintenance_requests")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (
    error &&
    (isMissingColumnError(error.message) || /photo_paths/i.test(error.message))
  ) {
    if (input.photoPaths && input.photoPaths.length > 0) {
      return {
        ok: false,
        error:
          "Photo/video storage is not set up. Ask the owner to run supabase/migrations/20260910_uploads_documents_cleanliness.sql and 20260911_maintenance_videos.sql in Supabase.",
      };
    }
    delete payload.photo_paths;
    const retry = await supabase
      .from("maintenance_requests")
      .insert(payload)
      .select("id")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create request." };
  }

  return { ok: true, id: data.id };
}

export async function updateMaintenanceStatus(
  supabase: SupabaseClient,
  id: string,
  status: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status: status.trim() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
