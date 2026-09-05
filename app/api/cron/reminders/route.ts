import { runAutomatedTenantReminders } from "@/lib/automated-reminders";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Daily automated WhatsApp: unpaid dues + unaccepted rental terms.
 * Vercel Cron: 09:00 Asia/Kolkata (03:30 UTC).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomatedTenantReminders();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    dues: {
      sent: result.dues.sent,
      skipped: result.dues.skipped,
      failed: result.dues.failed.length,
      errors: result.dues.failed,
    },
    terms: {
      sent: result.terms.sent,
      skipped: result.terms.skipped,
      failed: result.terms.failed.length,
      errors: result.terms.failed,
    },
  });
}
