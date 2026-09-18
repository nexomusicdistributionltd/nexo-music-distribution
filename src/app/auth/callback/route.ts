import { type NextRequest } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";

/**
 * Supabase authentication callback only.
 * Distribution-provider OAuth uses its own strict callback route so the two
 * independent authorization flows cannot consume each other's codes/state.
 */
export async function GET(request: NextRequest) {
  return completeAuthRedirect(request, "pkce");
}
