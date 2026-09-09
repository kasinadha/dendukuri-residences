import type { SupabaseClient } from "@supabase/supabase-js";
import { getHikConnectHlsUrl, hikConnectConfigured } from "@/lib/hikconnect";

export const CAMERA_STREAM_MODES = ["hikconnect", "hls", "link"] as const;
export type CameraStreamMode = (typeof CAMERA_STREAM_MODES)[number];

export type Camera = {
  id: string;
  name: string;
  location: string | null;
  streamMode: CameraStreamMode;
  deviceSerial: string | null;
  channelNo: number;
  hlsUrl: string | null;
  shareUrl: string | null;
  tenantVisible: boolean;
  enabled: boolean;
  sortOrder: number;
  notes: string | null;
};

export type CameraPlayback =
  | { kind: "hls"; url: string }
  | { kind: "link"; url: string }
  | { kind: "unavailable"; error: string };

function asMode(value: unknown): CameraStreamMode {
  const mode = String(value ?? "").toLowerCase();
  if (mode === "hls" || mode === "link" || mode === "hikconnect") return mode;
  return "hikconnect";
}

function mapCamera(row: Record<string, unknown>): Camera {
  return {
    id: String(row.id),
    name: String(row.name ?? "Camera"),
    location: typeof row.location === "string" ? row.location : null,
    streamMode: asMode(row.stream_mode),
    deviceSerial:
      typeof row.device_serial === "string" ? row.device_serial : null,
    channelNo: Number(row.channel_no) || 1,
    hlsUrl: typeof row.hls_url === "string" ? row.hls_url : null,
    shareUrl: typeof row.share_url === "string" ? row.share_url : null,
    tenantVisible: row.tenant_visible !== false,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order) || 0,
    notes: typeof row.notes === "string" ? row.notes : null,
  };
}

const CAMERA_SELECT =
  "id,name,location,stream_mode,device_serial,channel_no,hls_url,share_url,tenant_visible,enabled,sort_order,notes";

export async function listCameras(
  supabase: SupabaseClient,
  options?: { tenantOnly?: boolean }
): Promise<Camera[]> {
  let query = supabase
    .from("cameras")
    .select(CAMERA_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.tenantOnly) {
    query = query.eq("enabled", true).eq("tenant_visible", true);
  }

  const { data, error } = await query;
  if (error) {
    if (/does not exist|schema cache|cameras/i.test(error.message)) {
      return [];
    }
    return [];
  }
  return (data ?? []).map((row) => mapCamera(row as Record<string, unknown>));
}

export async function getCameraById(
  supabase: SupabaseClient,
  id: string
): Promise<Camera | null> {
  const { data, error } = await supabase
    .from("cameras")
    .select(CAMERA_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCamera(data as Record<string, unknown>);
}

export async function createCamera(
  supabase: SupabaseClient,
  input: {
    name: string;
    location?: string | null;
    streamMode: CameraStreamMode;
    deviceSerial?: string | null;
    channelNo?: number;
    hlsUrl?: string | null;
    shareUrl?: string | null;
    tenantVisible?: boolean;
    enabled?: boolean;
    sortOrder?: number;
    notes?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Camera name is required." };

  const { data, error } = await supabase
    .from("cameras")
    .insert({
      name,
      location: input.location?.trim() || null,
      stream_mode: input.streamMode,
      device_serial: input.deviceSerial?.trim() || null,
      channel_no: input.channelNo && input.channelNo > 0 ? input.channelNo : 1,
      hls_url: input.hlsUrl?.trim() || null,
      share_url: input.shareUrl?.trim() || null,
      tenant_visible: input.tenantVisible !== false,
      enabled: input.enabled !== false,
      sort_order: input.sortOrder ?? 0,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error && /does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Cameras table is not ready. Run supabase/migrations/20260908_cameras.sql in Supabase.",
      };
    }
    return { ok: false, error: error?.message ?? "Could not save camera." };
  }
  return { ok: true, id: data.id };
}

export async function updateCamera(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    name: string;
    location: string | null;
    streamMode: CameraStreamMode;
    deviceSerial: string | null;
    channelNo: number;
    hlsUrl: string | null;
    shareUrl: string | null;
    tenantVisible: boolean;
    enabled: boolean;
    sortOrder: number;
    notes: string | null;
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id.trim()) return { ok: false, error: "Missing camera id." };
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) payload.name = patch.name.trim();
  if (patch.location !== undefined) payload.location = patch.location?.trim() || null;
  if (patch.streamMode) payload.stream_mode = patch.streamMode;
  if (patch.deviceSerial !== undefined) {
    payload.device_serial = patch.deviceSerial?.trim() || null;
  }
  if (patch.channelNo != null) payload.channel_no = patch.channelNo;
  if (patch.hlsUrl !== undefined) payload.hls_url = patch.hlsUrl?.trim() || null;
  if (patch.shareUrl !== undefined) payload.share_url = patch.shareUrl?.trim() || null;
  if (patch.tenantVisible != null) payload.tenant_visible = patch.tenantVisible;
  if (patch.enabled != null) payload.enabled = patch.enabled;
  if (patch.sortOrder != null) payload.sort_order = patch.sortOrder;
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null;

  const { error } = await supabase.from("cameras").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCamera(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id.trim()) return { ok: false, error: "Missing camera id." };
  const { error } = await supabase.from("cameras").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveCameraPlayback(
  camera: Camera
): Promise<CameraPlayback> {
  if (camera.streamMode === "hls" && camera.hlsUrl) {
    return { kind: "hls", url: camera.hlsUrl };
  }
  if (camera.streamMode === "link" && camera.shareUrl) {
    return { kind: "link", url: camera.shareUrl };
  }

  if (camera.streamMode === "hikconnect" && camera.deviceSerial) {
    const live = await getHikConnectHlsUrl({
      deviceSerial: camera.deviceSerial,
      channelNo: camera.channelNo,
    });
    if (live.ok) return { kind: "hls", url: live.url };
    if (camera.shareUrl) return { kind: "link", url: camera.shareUrl };
    return { kind: "unavailable", error: live.error };
  }

  if (camera.shareUrl) return { kind: "link", url: camera.shareUrl };
  if (camera.hlsUrl) return { kind: "hls", url: camera.hlsUrl };

  if (camera.streamMode === "hikconnect" && !hikConnectConfigured()) {
    return {
      kind: "unavailable",
      error:
        "Set HIKCONNECT_APP_KEY and HIKCONNECT_APP_SECRET, or paste an HLS / Hik-Connect share URL.",
    };
  }

  return {
    kind: "unavailable",
    error: "This camera has no live address yet. Add a serial, HLS URL, or share link.",
  };
}
