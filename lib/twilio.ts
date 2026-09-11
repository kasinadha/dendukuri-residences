/**
 * Server-only Twilio WhatsApp REST client.
 * Uses Account SID + Auth Token (Basic auth) — never import from client components.
 *
 * Messages API: POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 */

const TWILIO_API_VERSION = "2010-04-01";
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

export type TwilioWhatsAppConfig = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type TwilioSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; status?: number; code?: number };

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Normalize sender to `whatsapp:+E164` (sandbox example: whatsapp:+14155238886). */
export function normalizeTwilioWhatsAppFrom(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("whatsapp:")) {
    const rest = trimmed.slice("whatsapp:".length).trim();
    if (rest.startsWith("+")) return `whatsapp:${rest}`;
    const digits = rest.replace(/\D/g, "");
    return digits ? `whatsapp:+${digits}` : trimmed;
  }
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : trimmed;
}

export function toTwilioWhatsAppTo(e164Digits: string): string {
  const digits = e164Digits.replace(/\D/g, "");
  return `whatsapp:+${digits}`;
}

/**
 * Twilio WhatsApp is configured when SID + token + From are set.
 * Marketplace install did not provision keys (Twilio is not on Vercel Marketplace);
 * these are the standard Twilio console names plus TWILIO_WHATSAPP_FROM.
 */
export function getTwilioWhatsAppConfig(): TwilioWhatsAppConfig | null {
  const accountSid = readEnv(
    "TWILIO_ACCOUNT_SID",
    "TWILIO_SID",
    "ACCOUNT_SID"
  );
  const authToken = readEnv(
    "TWILIO_AUTH_TOKEN",
    "TWILIO_AUTHTOKEN",
    "AUTH_TOKEN"
  );
  const fromRaw = readEnv(
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_FROM",
    "TWILIO_WHATSAPP_NUMBER"
  );
  if (!accountSid || !authToken || !fromRaw) return null;
  return {
    accountSid,
    authToken,
    from: normalizeTwilioWhatsAppFrom(fromRaw),
  };
}

export function isTwilioWhatsAppConfigured(): boolean {
  return getTwilioWhatsAppConfig() != null;
}

export function getTwilioContentSid(kind: "dues" | "terms"): string | null {
  return (
    readEnv(
      kind === "dues" ? "TWILIO_CONTENT_SID_DUES" : "TWILIO_CONTENT_SID_TERMS"
    ) ?? null
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function basicAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function explainTwilioError(
  status: number,
  payload: { code?: number; message?: string; more_info?: string } | null
): string {
  const code = payload?.code;
  const message = payload?.message?.trim();
  if (status === 401 || code === 20003) {
    return "Twilio rejected the credentials. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.";
  }
  if (code === 21608 || code === 21610) {
    return "This WhatsApp number is not allowed to message that recipient yet. Join the Twilio sandbox (send the join code) or register the live business number.";
  }
  if (code === 63016 || code === 63007) {
    return "Twilio WhatsApp needs an approved template (ContentSid) outside the 24-hour session window. Set TWILIO_CONTENT_SID_DUES / TWILIO_CONTENT_SID_TERMS.";
  }
  if (code === 21211) {
    return "Tenant mobile number is not a valid WhatsApp destination.";
  }
  if (message) return message;
  return `Twilio send failed (HTTP ${status}).`;
}

type TwilioMessageResponse = {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  code?: number;
  message?: string;
  more_info?: string;
};

async function postTwilioMessage(
  config: TwilioWhatsAppConfig,
  fields: Record<string, string>
): Promise<TwilioSendResult & { retryable?: boolean }> {
  const url = `https://api.twilio.com/${TWILIO_API_VERSION}/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const body = new URLSearchParams(fields);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.accountSid, config.authToken),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | TwilioMessageResponse
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error: `WhatsApp send failed: ${explainTwilioError(response.status, payload)}`,
      status: response.status,
      code: payload?.code ?? payload?.error_code ?? undefined,
      retryable: isRetryableStatus(response.status),
    };
  }

  const messageId = payload?.sid?.trim();
  if (!messageId) {
    return {
      ok: false,
      error: "Twilio accepted the request but no message SID was returned.",
    };
  }

  return { ok: true, messageId };
}

async function postTwilioMessageWithRetry(
  config: TwilioWhatsAppConfig,
  fields: Record<string, string>
): Promise<TwilioSendResult> {
  let last: TwilioSendResult = {
    ok: false,
    error: "Twilio send did not run.",
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await postTwilioMessage(config, fields);
    if (result.ok) return result;
    last = result;
    if (!result.retryable || attempt === MAX_ATTEMPTS - 1) return result;
    await sleep(RETRY_BASE_MS * 2 ** attempt);
  }

  return last;
}

export async function sendTwilioWhatsAppMessage(input: {
  toE164Digits: string;
  body?: string;
  contentSid?: string | null;
  contentVariables?: string[] | null;
  mediaUrl?: string | null;
}): Promise<TwilioSendResult> {
  const config = getTwilioWhatsAppConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Twilio WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM.",
    };
  }

  const toDigits = input.toE164Digits.replace(/\D/g, "");
  if (toDigits.length < 11) {
    return { ok: false, error: "Tenant mobile number is missing or invalid." };
  }

  const fields: Record<string, string> = {
    From: config.from,
    To: toTwilioWhatsAppTo(toDigits),
  };

  if (input.contentSid?.trim()) {
    fields.ContentSid = input.contentSid.trim();
    if (input.contentVariables && input.contentVariables.length > 0) {
      const variables: Record<string, string> = {};
      input.contentVariables.forEach((value, index) => {
        variables[String(index + 1)] = value;
      });
      fields.ContentVariables = JSON.stringify(variables);
    }
  } else if (input.body?.trim()) {
    fields.Body = input.body;
  } else if (!input.mediaUrl?.trim()) {
    return { ok: false, error: "Message body, template, or media is required." };
  }

  if (input.mediaUrl?.trim()) {
    fields.MediaUrl = input.mediaUrl.trim();
    if (!fields.Body && input.body?.trim()) {
      fields.Body = input.body;
    }
  }

  return postTwilioMessageWithRetry(config, fields);
}
