import { type NextRequest } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";
import {
  handleDistributionOAuthCallback,
  isDistributionOAuthCallbackRequest,
} from "@/lib/provider/oauth/callback";

/**
 * Supabase authentication callback by default.
 *
 * The Distribution Engine previously used this registered callback path. Keep
 * a strict compatibility handoff so existing provider app registrations can
 * authorize without changing their callback URI, while Supabase PKCE remains
 * isolated from provider OAuth state.
 */
export async function GET(request: NextRequest) {
  if (isDistributionOAuthCallbackRequest(request)) {
    return handleDistributionOAuthCallback(request);
  }
  return completeAuthRedirect(request, "pkce");
}
