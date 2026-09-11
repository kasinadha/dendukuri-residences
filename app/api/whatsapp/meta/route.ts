import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API inbound webhook.
 *
 * Meta App → WhatsApp → Configuration → Callback URL:
 *   GET/POST https://<your-domain>/api/whatsapp/meta
 * Verify token must match WHATSAPP_VERIFY_TOKEN.
 *
 * Logs inbound messages. Full maintenance-ticket parsing is a follow-up.
 */

type MetaInboundMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
};

type MetaInboundPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaInboundMessage[];
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
      };
    }>;
  }>;
};

function validMetaSignature(
  rawBody: string,
  header: string,
  appSecret: string
): boolean {
  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => "");
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const signature = request.headers.get("x-hub-signature-256")?.trim() || "";

  if (appSecret) {
    if (!signature || !validMetaSignature(rawBody, signature, appSecret)) {
      console.warn("[whatsapp/meta] invalid signature");
      return NextResponse.json({ error: "Invalid Meta signature" }, { status: 403 });
    }
  } else {
    console.warn(
      "[whatsapp/meta] WHATSAPP_APP_SECRET missing — inbound accepted without signature check"
    );
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as MetaInboundPayload;
    } catch {
      return null;
    }
  })();

  const messages =
    payload?.entry?.flatMap(
      (entry) =>
        entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []
    ) ?? [];

  for (const message of messages) {
    console.info("[whatsapp/meta] inbound", {
      messageId: message.id ?? null,
      from: message.from ?? null,
      type: message.type ?? null,
      body: message.text?.body ?? "",
    });
  }

  if (messages.length === 0) {
    console.info("[whatsapp/meta] inbound (no messages)", {
      bytes: rawBody.length,
    });
  }

  return NextResponse.json({ ok: true });
}
