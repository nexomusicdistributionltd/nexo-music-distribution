import { NextResponse } from "next/server";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createDistributionAuthorizationUrl } from "@/lib/provider/oauth/authorize";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";

export async function GET() {
  await RequireAdministrator();
  if (!isDistributionOAuthConfigured()) {
    return NextResponse.json(
      { error: "Distribution Engine OAuth is not configured on the server." },
      { status: 503 }
    );
  }
  const { url } = createDistributionAuthorizationUrl();
  return NextResponse.redirect(url);
}
