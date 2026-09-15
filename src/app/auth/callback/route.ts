import { type NextRequest } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";

/** PKCE code exchange. Recovery emails redirect to /reset-password; that page forwards ?code= here. */
export async function GET(request: NextRequest) {
  return completeAuthRedirect(request, "pkce");
}
