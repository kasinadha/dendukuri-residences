import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getTwilioWhatsAppConfig } from "@/lib/twilio";

export const dynamic = "force-dynamic";

/**
 * Twilio WhatsApp inbound webhook.
 *
 * Console → Messaging → WhatsApp sandbox / sender → "When a message comes in":
 *   POST https://<your-domain>/api/whatsapp/twilio
 *
 * Verifies X-Twilio-Signature when TWILIO_AUTH_TOKEN is set.
 * Logs inbound fields. Full maintenance-ticket parsing is a follow-up.
 */
const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twimlOk(): NextResponse {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function publicRequestUrl(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    const path = new URL(request.url).pathname;
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  return request.url;
}

function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac("sha1", authToken)
    .update(data, "utf8")
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function formToParams(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && params[key] == null) {
      params[key] = value;
    }
  }
  return params;
}

export async function GET() {
  return new NextResponse("Dendukuri Twilio WhatsApp webhook", { status: 200 });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const params = form ? formToParams(form) : {};
  const config = getTwilioWhatsAppConfig();
  const signature = request.headers.get("x-twilio-signature")?.trim() || "";

  if (config?.authToken) {
    const urls = [publicRequestUrl(request), request.url].filter(
      (url, index, all) => all.indexOf(url) === index
    );
    const valid = urls.some((url) =>
      validateTwilioSignature(config.authToken, signature, url, params)
    );
    if (!valid) {
      console.warn("[whatsapp/twilio] invalid signature", {
        url: publicRequestUrl(request),
      });
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
  } else {
    console.warn(
      "[whatsapp/twilio] TWILIO_AUTH_TOKEN missing — inbound accepted without signature check"
    );
  }

  console.info("[whatsapp/twilio] inbound", {
    messageSid: params.MessageSid ?? null,
    from: params.From ?? null,
    to: params.To ?? null,
    waId: params.WaId ?? null,
    numMedia: params.NumMedia ?? "0",
    body: params.Body ?? "",
  });

  return twimlOk();
}
