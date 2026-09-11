/** Client-safe WhatsApp phone helpers. Do not import send clients from here. */

/** Dedicated business line for tenant reminders (+91 8867887061). */
export const WHATSAPP_BUSINESS_PHONE_E164 = "918867887061";

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

/** Opens WhatsApp chat to tenant with a pre-filled reminder (sender = logged-in WA account). */
export function toTenantWhatsAppUrl(
  tenantPhone: string | null | undefined,
  message: string
): string | null {
  const digits = normalizeTenantWhatsAppDigits(tenantPhone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
