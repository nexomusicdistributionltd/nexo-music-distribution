import { type NextRequest } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";

/** PKCE only — password recovery redirectTo lands here with ?code=&next=/reset-password */
export async function GET(request: NextRequest) {
  return completeAuthRedirect(request, "pkce");
}
