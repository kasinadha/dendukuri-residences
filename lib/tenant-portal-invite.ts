import { PROPERTY_NAME } from "@/lib/property";
import { toTenantWhatsAppUrl } from "@/lib/whatsapp";

export function buildTenantPortalInviteMessage(input: {
  tenantName: string;
  flatNumber?: string | null;
  mobile: string;
  password: string;
  loginUrl: string;
}): string {
  const flatLine = input.flatNumber?.trim()
    ? `Flat ${input.flatNumber.trim()}`
    : PROPERTY_NAME;
  return [
    `Hi ${input.tenantName.trim()},`,
    "",
    `Your tenant portal login for ${flatLine} is ready.`,
    "",
    `Login page: ${input.loginUrl}`,
    `Mobile: ${input.mobile.trim()}`,
    `Password: ${input.password}`,
    "",
    "Sign in with your 10-digit mobile number and this password. You can pay rent, view receipts, and raise maintenance requests.",
    "",
    `— ${PROPERTY_NAME}`,
  ].join("\n");
}

export function tenantPortalInviteWhatsAppUrl(input: {
  tenantPhone: string | null;
  tenantName: string;
  flatNumber?: string | null;
  mobile: string;
  password: string;
  loginUrl: string;
}): string | null {
  return toTenantWhatsAppUrl(
    input.tenantPhone,
    buildTenantPortalInviteMessage(input)
  );
}
