import { sendAllPendingAgreementWhatsAppReminders } from "@/lib/agreements";
import { sendAllUnpaidWhatsAppReminders } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppBusinessConfig } from "@/lib/whatsapp";

/** Skip tenants already reminded in this window so a daily cron does not double-send. */
export const AUTOMATED_REMINDER_SKIP_HOURS = 20;

export type AutomatedReminderResult = {
  ok: true;
  dues: {
    sent: number;
    skipped: number;
    failed: Array<{ tenancyId: string; tenantName: string; error: string }>;
  };
  terms: {
    sent: number;
    skipped: number;
    failed: Array<{ tenancyId: string; tenantName: string; error: string }>;
  };
};

export async function runAutomatedTenantReminders(): Promise<
  | AutomatedReminderResult
  | { ok: false; error: string }
> {
  const whatsapp = getWhatsAppBusinessConfig();
  if (!whatsapp.apiEnabled) {
    return {
      ok: false,
      error:
        "WhatsApp Cloud API is not configured. Set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID so reminders can send without opening WhatsApp Web.",
    };
  }

  const admin = createAdminClient();
  if (!admin.ok) return admin;

  const dues = await sendAllUnpaidWhatsAppReminders(admin.client, {
    remindedBy: null,
    channel: "whatsapp_cron",
    skipRemindedWithinHours: AUTOMATED_REMINDER_SKIP_HOURS,
  });
  const terms = await sendAllPendingAgreementWhatsAppReminders(admin.client, {
    remindedBy: null,
    channel: "whatsapp_cron",
    skipRemindedWithinHours: AUTOMATED_REMINDER_SKIP_HOURS,
  });

  return { ok: true, dues, terms };
}
