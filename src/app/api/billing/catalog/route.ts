import { NextResponse } from "next/server";
import { publicBillingCatalog } from "@/lib/billing/catalog";
import { getPaddleClientToken } from "@/lib/billing/env";
import { countryFromTrustedHeaders } from "@/lib/billing/country";

export const runtime = "nodejs";

/** Public catalog for /pricing PricePreview. Price IDs are catalog identifiers, not secrets. */
export async function GET(req: Request) {
  const catalog = publicBillingCatalog();
  const country = countryFromTrustedHeaders(req.headers);
  return NextResponse.json({
    ok: true,
    catalog,
    clientToken: getPaddleClientToken() || null,
    country,
  });
}
