import { type NextRequest } from "next/server";
import { handleDistributionOAuthCallback } from "@/lib/provider/oauth/callback";

export async function GET(request: NextRequest) {
  return handleDistributionOAuthCallback(request);
}
