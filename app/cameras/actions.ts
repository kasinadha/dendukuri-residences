"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAdminOrTenant } from "@/lib/auth";
import {
  CAMERA_STREAM_MODES,
  createCamera,
  deleteCamera,
  getCameraById,
  resolveCameraPlayback,
  updateCamera,
  type CameraStreamMode,
} from "@/lib/cameras";
import { formatActionError } from "@/lib/format-action-error";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asMode(raw: string): CameraStreamMode {
  const mode = raw.toLowerCase();
  if (CAMERA_STREAM_MODES.includes(mode as CameraStreamMode)) {
    return mode as CameraStreamMode;
  }
  return "hikconnect";
}

export async function fetchCameraStreamAction(formData: FormData) {
  const { supabase, profile } = await requireAdminOrTenant();
  try {
    const id = asString(formData, "camera_id");
    if (!id) return { ok: false as const, error: "Missing camera." };

    const camera = await getCameraById(supabase, id);
    if (!camera) {
      return { ok: false as const, error: "Camera not found." };
    }
    if (profile.role === "tenant") {
      if (!camera.enabled || !camera.tenantVisible) {
        return { ok: false as const, error: "This camera is not available." };
      }
    }

    const playback = await resolveCameraPlayback(camera);
    if (playback.kind === "unavailable") {
      return { ok: false as const, error: playback.error };
    }
    return { ok: true as const, playback };
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not load the live view."),
    };
  }
}

export async function createCameraAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const channelRaw = asString(formData, "channel_no");
    const sortRaw = asString(formData, "sort_order");
    const result = await createCamera(supabase, {
      name: asString(formData, "name"),
      location: asString(formData, "location") || null,
      streamMode: asMode(asString(formData, "stream_mode")),
      deviceSerial: asString(formData, "device_serial") || null,
      channelNo: channelRaw ? Number(channelRaw) : 1,
      hlsUrl: asString(formData, "hls_url") || null,
      shareUrl: asString(formData, "share_url") || null,
      tenantVisible: asString(formData, "tenant_visible") === "1",
      enabled: asString(formData, "enabled") === "1",
      sortOrder: sortRaw ? Number(sortRaw) : 0,
      notes: asString(formData, "notes") || null,
    });
    if (result.ok) {
      revalidatePath("/admin/cameras");
      revalidatePath("/tenant/cameras");
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not save the camera."),
    };
  }
}

export async function updateCameraAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const id = asString(formData, "id");
    const channelRaw = asString(formData, "channel_no");
    const sortRaw = asString(formData, "sort_order");
    const result = await updateCamera(supabase, id, {
      name: asString(formData, "name"),
      location: asString(formData, "location") || null,
      streamMode: asMode(asString(formData, "stream_mode")),
      deviceSerial: asString(formData, "device_serial") || null,
      channelNo: channelRaw ? Number(channelRaw) : 1,
      hlsUrl: asString(formData, "hls_url") || null,
      shareUrl: asString(formData, "share_url") || null,
      tenantVisible: asString(formData, "tenant_visible") === "1",
      enabled: asString(formData, "enabled") === "1",
      sortOrder: sortRaw ? Number(sortRaw) : 0,
      notes: asString(formData, "notes") || null,
    });
    if (result.ok) {
      revalidatePath("/admin/cameras");
      revalidatePath("/tenant/cameras");
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not update the camera."),
    };
  }
}

export async function deleteCameraAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const result = await deleteCamera(supabase, asString(formData, "id"));
    if (result.ok) {
      revalidatePath("/admin/cameras");
      revalidatePath("/tenant/cameras");
    }
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not remove the camera."),
    };
  }
}