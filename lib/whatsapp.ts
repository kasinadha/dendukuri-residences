/**
 * Server-only WhatsApp send path (Twilio REST, else Meta Cloud API).
 * Client UI must import phone helpers from `@/lib/whatsapp-phone`.
 */
import {
  getTwilioContentSid,
  isTwilioWhatsAppConfigured,
  sendTwilioWhatsAppMessage,
} from "@/lib/twilio";
import {
  WHATSAPP_BUSINESS_PHONE_E164,
  digitsOnly,
  formatWhatsAppBusinessPhoneDisplay,
  normalizeTenantWhatsAppDigits,
} from "@/lib/whatsapp-phone";

export {
  WHATSAPP_BUSINESS_PHONE_E164,
  digitsOnly,
  formatWhatsAppBusinessPhoneDisplay,
  normalizeTenantWhatsAppDigits,
  toTenantWhatsAppUrl,
} from "@/lib/whatsapp-phone";

export type WhatsAppBusinessConfig = {
  /** E.164 digits only, e.g. 918867887061 */
  businessPhone: string;
  /** Human-readable label for admin UI, e.g. +91 88678 87061 */
  businessPhoneDisplay: string;
  /** Twilio WhatsApp (preferred) or Meta Cloud API configured */
  apiEnabled: boolean;
  provider: "twilio" | "meta" | "none";
};

export type WhatsAppTemplateSend = {
  name: string;
  language?: string;
  bodyParams?: string[];
};

type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  error_data?: { details?: string };
};

function looksLikePhoneNumberId(value: string): boolean {
  const digits = digitsOnly(value);
  return (
    digits.length >= 15 &&
    digits.length <= 20 &&
    value.trim() === digits
  );
}

export function getWhatsAppTemplateName(kind: "dues" | "terms"): string | null {
  if (isTwilioWhatsAppConfigured()) {
    const contentSid = getTwilioContentSid(kind);
    if (contentSid) return contentSid;
  }
  const key =
    kind === "dues"
      ? process.env.WHATSAPP_TEMPLATE_DUES
      : process.env.WHATSAPP_TEMPLATE_TERMS;
  return key?.trim() || null;
}

export function getWhatsAppTemplateLanguage(): string {
  return process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en";
}

export function getWhatsAppBusinessConfig(): WhatsAppBusinessConfig {
  const raw =
    process.env.WHATSAPP_BUSINESS_PHONE?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE?.trim() ||
    WHATSAPP_BUSINESS_PHONE_E164;
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const twilio = isTwilioWhatsAppConfigured();
  const meta = Boolean(token && phoneNumberId);

  const businessPhone =
    normalizeTenantWhatsAppDigits(raw) ?? WHATSAPP_BUSINESS_PHONE_E164;

  return {
    businessPhone,
    businessPhoneDisplay: formatWhatsAppBusinessPhoneDisplay(businessPhone),
    apiEnabled: twilio || meta,
    provider: twilio ? "twilio" : meta ? "meta" : "none",
  };
}

function explainGraphError(status: number, error: GraphError | undefined): string {
  const code = error?.code;
  const details =
    error?.error_data?.details ||
    error?.error_user_msg ||
    error?.message ||
    `HTTP ${status}`;

  if (code === 190) {
    return "Access token is invalid or expired. Use a System User token from Meta Business settings, not the 24-hour temporary token from API setup.";
  }
  if (code === 100 && /template/i.test(`${error?.message} ${details}`)) {
    return "Meta rejected free-form text. Daily reminders must use an approved Utility template. Set WHATSAPP_TEMPLATE_DUES / WHATSAPP_TEMPLATE_TERMS after Meta approves them.";
  }
  if (code === 131047) {
    return "Meta blocked the send: tenants have not messaged this business number in the last 24 hours. Create and approve a Utility template, then set WHATSAPP_TEMPLATE_DUES / WHATSAPP_TEMPLATE_TERMS.";
  }
  if (code === 131030) {
    return "This Cloud API number can only message numbers on its allowed list (common with Meta's test number). Add each tenant, or register your real business WhatsApp (+91 88678 87061) instead of the test number.";
  }
  if (code === 132001 || code === 132000) {
    return `Template was not found or is not approved (${details}). Check the template name in WhatsApp Manager and WHATSAPP_TEMPLATE_DUES / WHATSAPP_TEMPLATE_TERMS.`;
  }
  if (status === 404) {
    return "Phone number ID was not found. WHATSAPP_PHONE_NUMBER_ID must be the Phone number ID from WhatsApp → API setup, not the mobile number 8867887061.";
  }
  return details;
}

function templatePayload(
  to: string,
  template: WhatsAppTemplateSend
): Record<string, unknown> {
  const components =
    template.bodyParams && template.bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: template.bodyParams.map((text) => ({
              type: "text",
              text,
            })),
          },
        ]
      : undefined;

  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language || getWhatsAppTemplateLanguage() },
      ...(components ? { components } : {}),
    },
  };
}

const META_MAX_ATTEMPTS = 3;
const META_RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function whatsappApiNotConfiguredError(): string {
  return "WhatsApp API is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM — or WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID.";
}

async function postWhatsAppMessageOnce(
  token: string,
  phoneNumberId: string,
  body: Record<string, unknown>
): Promise<
  | { ok: true; messageId: string }
  | { ok: false; error: string; code?: number; retryable?: boolean }
> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { messages?: Array<{ id: string }>; error?: GraphError }
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error: `WhatsApp send failed: ${explainGraphError(response.status, payload?.error)}`,
      code: payload?.error?.code,
      retryable: isRetryableHttpStatus(response.status),
    };
  }

  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) {
    return {
      ok: false,
      error: "WhatsApp accepted the request but no message id returned.",
    };
  }

  return { ok: true, messageId };
}

async function postWhatsAppMessage(
  token: string,
  phoneNumberId: string,
  body: Record<string, unknown>
): Promise<{ ok: true; messageId: string } | { ok: false; error: string; code?: number }> {
  let last: { ok: false; error: string; code?: number } = {
    ok: false,
    error: "WhatsApp send did not run.",
  };

  for (let attempt = 0; attempt < META_MAX_ATTEMPTS; attempt += 1) {
    const result = await postWhatsAppMessageOnce(token, phoneNumberId, body);
    if (result.ok) return result;
    last = result;
    if (!result.retryable || attempt === META_MAX_ATTEMPTS - 1) return result;
    await sleep(META_RETRY_BASE_MS * 2 ** attempt);
  }

  return last;
}

function documentPayload(
  to: string,
  mediaUrl: string,
  caption: string,
  fileName?: string | null
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link: mediaUrl,
      filename: fileName?.trim() || "receipt.pdf",
      ...(caption.trim() ? { caption: caption.slice(0, 1024) } : {}),
    },
  };
}

export async function sendWhatsAppBusinessMessage(input: {
  toPhone: string;
  body: string;
  template?: WhatsAppTemplateSend | null;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const to = normalizeTenantWhatsAppDigits(input.toPhone);
  if (!to) {
    return { ok: false, error: "Tenant mobile number is missing or invalid." };
  }

  if (isTwilioWhatsAppConfigured()) {
    return sendTwilioWhatsAppMessage({
      toE164Digits: to,
      body: input.body,
      contentSid: input.template?.name,
      contentVariables: input.template?.bodyParams,
      mediaUrl: input.mediaUrl,
    });
  }

  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error: whatsappApiNotConfiguredError(),
    };
  }

  if (!looksLikePhoneNumberId(phoneNumberId)) {
    return {
      ok: false,
      error:
        "WHATSAPP_PHONE_NUMBER_ID looks wrong. Copy Phone number ID from Meta → WhatsApp → API setup (a long numeric id). Do not paste the mobile number 8867887061 or the WhatsApp Business Account ID.",
    };
  }

  if (input.mediaUrl?.trim()) {
    return postWhatsAppMessage(
      token,
      phoneNumberId,
      documentPayload(to, input.mediaUrl.trim(), input.body, input.mediaFileName)
    );
  }

  if (input.template?.name) {
    return postWhatsAppMessage(
      token,
      phoneNumberId,
      templatePayload(to, input.template)
    );
  }

  const textResult = await postWhatsAppMessage(token, phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: input.body, preview_url: false },
  });
  if (textResult.ok) return textResult;

  const needsTemplate =
    textResult.code === 131047 ||
    textResult.code === 100 ||
    textResult.code === 131055;
  if (needsTemplate) {
    return {
      ok: false,
      error: textResult.error,
    };
  }

  return textResult;
}
