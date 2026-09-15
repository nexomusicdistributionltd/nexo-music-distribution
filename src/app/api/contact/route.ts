import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = checkRateLimit({
    key: `contact:${ip}`,
    ...RATE_LIMITS.contact,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (name.length < 2 || subject.length < 2 || message.length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid fields." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
  }
  if (name.length > 200 || subject.length > 300 || message.length > 10000) {
    return NextResponse.json({ ok: false, error: "Fields too long." }, { status: 400 });
  }

  const supabase = await createClient();
  const ua = request.headers.get("user-agent");
  const { data, error } = await supabase.rpc("submit_contact_message", {
    p_name: name,
    p_email: email,
    p_subject: subject,
    p_message: message,
    p_source_ip: null,
    p_user_agent: ua?.slice(0, 500) ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error.message, "Could not submit message.") },
      { status: 400 }
    );
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const { enqueueTransactionalEmail } = await import("@/lib/email/hooks");
    const service = createServiceClient();
    await enqueueTransactionalEmail({
      supabase: service,
      templateKey: "CONTACT_ACKNOWLEDGEMENT",
      eventType: "contact",
      to: email,
      relatedEntityType: "contact_message",
      relatedEntityId: typeof data === "string" ? data : null,
      payload: {
        FIRST_NAME: name.split(/\s+/)[0] || "there",
        CONTACT_SUBJECT: subject,
        CTA_URL: "https://nexomusicdistribution.com",
        CTA_LABEL: "Visit Nexo",
        PREHEADER: "We received your message",
      },
      idempotencyKey: `CONTACT_ACK:${typeof data === "string" ? data : email}:${subject}`,
    });
  } catch {
    /* acknowledgement is best-effort; the inquiry is stored */
  }

  return NextResponse.json(
    { ok: true, id: data },
    { headers: rateLimitHeaders(limited) }
  );
}
