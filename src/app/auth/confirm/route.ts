import { type NextRequest } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";

/** token_hash + type (signup/recovery/email_change) — PKCE code is a fallback. */
export async function GET(request: NextRequest) {
  return completeAuthRedirect(request, "otp");
}
