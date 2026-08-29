/** Dedicated business line for tenant reminders (+91 8867887061). */
export const WHATSAPP_BUSINESS_PHONE_E164 = "918867887061";

export type WhatsAppBusinessConfig = {
  /** E.164 digits only, e.g. 918867887061 */
  businessPhone: string;
  /** Human-readable label for admin UI, e.g. +91 88678 87061 */
  businessPhoneDisplay: string;
  /** Meta WhatsApp Cloud API configured */
  apiEnabled: boolean;
};

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeTenantWhatsAppDigits(
  phone: string | null | undefined
): string | null {
  let digits = digitsOnly(phone);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  return digits;
}

export function formatWhatsAppBusinessPhoneDisplay(
  phone: string | null | undefined
): string {
  const digits =
    normalizeTenantWhatsAppDigits(phone) ?? WHATSAPP_BUSINESS_PHONE_E164;
  if (digits.startsWith("91") && digits.length === 12) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return `+${digits}`;
}

export function getWhatsAppBusinessConfig(): WhatsAppBusinessConfig {
  const raw =
    process.env.WHATSAPP_BUSINESS_PHONE?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE?.trim() ||
    WHATSAPP_BUSINESS_PHONE_E164;
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  const businessPhone =
    normalizeTenantWhatsAppDigits(raw) ?? WHATSAPP_BUSINESS_PHONE_E164;

  return {
    businessPhone,
    businessPhoneDisplay: formatWhatsAppBusinessPhoneDisplay(businessPhone),
    apiEnabled: Boolean(token && phoneNumberId),
  };
}

/** Opens WhatsApp chat to tenant with a pre-filled reminder (sender = logged-in WA account). */
export function toTenantWhatsAppUrl(
  tenantPhone: string | null | undefined,
  message: string
): string | null {
  const digits = normalizeTenantWhatsAppDigits(tenantPhone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function sendWhatsAppBusinessMessage(input: {
  toPhone: string;
  body: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error:
        "WhatsApp API is not configured. Set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    };
  }

  const to = normalizeTenantWhatsAppDigits(input.toPhone);
  if (!to) {
    return { ok: false, error: "Tenant mobile number is missing or invalid." };
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: input.body },
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { messages?: Array<{ id: string }>; error?: { message?: string } }
    | null;

  if (!response.ok) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    return {
      ok: false,
      error: `WhatsApp send failed: ${detail}. For first-time outreach you may need an approved message template in Meta Business.`,
    };
  }

  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: "WhatsApp accepted the request but no message id returned." };
  }

  return { ok: true, messageId };
}
