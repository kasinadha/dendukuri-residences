const DEFAULT_API_BASE = "https://open.ezvizlife.com";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function apiBase(): string {
  return (
    process.env.HIKCONNECT_API_BASE?.trim().replace(/\/$/, "") ||
    DEFAULT_API_BASE
  );
}

export function hikConnectConfigured(): boolean {
  return Boolean(
    process.env.HIKCONNECT_APP_KEY?.trim() &&
      process.env.HIKCONNECT_APP_SECRET?.trim()
  );
}

export function hikConnectStreamDomain(): string {
  return (
    process.env.HIKCONNECT_STREAM_DOMAIN?.trim().replace(/\/$/, "") ||
    "https://isgpopen.ezvizlife.com"
  );
}

async function postForm(
  path: string,
  body: Record<string, string>
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const url = `${apiBase()}${path}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      cache: "no-store",
    });
    const json = (await response.json()) as Record<string, unknown>;
    return { ok: true, json };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, error: `Could not reach Hik-Connect (${message}).` };
  }
}

export async function getHikConnectAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  if (!hikConnectConfigured()) {
    return {
      ok: false,
      error:
        "Hik-Connect API keys are not set. Add HIKCONNECT_APP_KEY and HIKCONNECT_APP_SECRET, or use an HLS / share URL on the camera.",
    };
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return { ok: true, token: tokenCache.token };
  }

  const result = await postForm("/api/lapp/token/get", {
    appKey: process.env.HIKCONNECT_APP_KEY!.trim(),
    appSecret: process.env.HIKCONNECT_APP_SECRET!.trim(),
  });
  if (!result.ok) return result;

  const code = String(result.json.code ?? "");
  const data = result.json.data as
    | { accessToken?: string; expireTime?: number }
    | undefined;
  if (code !== "200" || !data?.accessToken) {
    const msg = String(result.json.msg ?? result.json.message ?? "token failed");
    return {
      ok: false,
      error: `Hik-Connect token failed (${code || "error"}: ${msg}). Check app key/secret and API region.`,
    };
  }

  const expiresAt =
    typeof data.expireTime === "number" && data.expireTime > Date.now()
      ? data.expireTime
      : Date.now() + 6 * 24 * 60 * 60 * 1000;
  tokenCache = { token: data.accessToken, expiresAt };
  return { ok: true, token: data.accessToken };
}

export async function getHikConnectHlsUrl(input: {
  deviceSerial: string;
  channelNo: number;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = await getHikConnectAccessToken();
  if (!token.ok) return token;

  const serial = input.deviceSerial.trim();
  if (!serial) return { ok: false, error: "Camera serial is missing." };
  const channelNo = Number.isFinite(input.channelNo) ? input.channelNo : 1;

  const result = await postForm("/api/lapp/v2/live/address/get", {
    accessToken: token.token,
    deviceSerial: serial,
    channelNo: String(channelNo),
    protocol: "2",
  });
  if (!result.ok) return result;

  const code = String(result.json.code ?? "");
  const data = result.json.data as { url?: string } | undefined;
  if (code === "200" && data?.url) {
    return { ok: true, url: data.url };
  }

  const fallback = await postForm("/api/lapp/live/address/get", {
    accessToken: token.token,
    deviceSerial: serial,
    channelNo: String(channelNo),
    protocol: "2",
  });
  if (!fallback.ok) return fallback;
  const fallbackCode = String(fallback.json.code ?? "");
  const fallbackData = fallback.json.data as { url?: string } | undefined;
  if (fallbackCode === "200" && fallbackData?.url) {
    return { ok: true, url: fallbackData.url };
  }

  const msg = String(
    result.json.msg ??
      fallback.json.msg ??
      "HLS live address unavailable (camera encryption may be on)."
  );
  return { ok: false, error: msg };
}
