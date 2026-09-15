import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";
import {
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
} from "@/lib/newsletter/email";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = checkRateLimit({
    key: `newsletter:${ip}`,
    ...RATE_LIMITS.newsletter,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: { email?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = normalizeNewsletterEmail(body.email);
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 80) : "footer";

  if (!isValidNewsletterEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscribe_newsletter", {
    p_email: email,
    p_source: source || "footer",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error.message, "Could not subscribe.") },
      { status: 400 }
    );
  }

  const result = data as { ok?: boolean; id?: string; duplicate?: boolean } | null;

  return NextResponse.json(
    {
      ok: true,
      id: result?.id ?? null,
      duplicate: Boolean(result?.duplicate),
    },
    { headers: rateLimitHeaders(limited) }
  );
}
