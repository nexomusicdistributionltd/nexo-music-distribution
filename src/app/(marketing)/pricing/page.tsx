import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section } from "@/components/marketing/Section";
import { PricingTable } from "@/components/billing/PricingTable";
import { publicBillingCatalog } from "@/lib/billing/catalog";
import { countryFromTrustedHeaders } from "@/lib/billing/country";
import { getPaddleClientToken } from "@/lib/billing/env";
import { parseBillingSelection } from "@/lib/billing/auth-return";
import { billingAccountTypeFromRoles } from "@/lib/billing/eligibility";
import { getOptionalAuth } from "@/lib/auth/guards";
import { COMPANY_LEGAL, SITE_URL } from "@/lib/site";
import { BRAND_PUBLIC_URL } from "@/lib/brand/social";
import { isPaidTierId } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Music Distribution Pricing for Artists & Labels",
  description:
    "Music distribution pricing for artists and labels from NEXO MUSIC DISTRIBUTION LTD. Artist Starter is free. Artist Pro from $9.99/month, Label Starter from $19.99/month, Label Pro from $49.99/month (USD), with approved Paddle prices for the UK, Ireland, and Australia. Paid plans include a 7-day trial.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Music Distribution Pricing for Artists & Labels | NEXO Music Distribution",
    description:
      "USD plans for artists and labels. Artist Starter is free. Paid plans include a 7-day trial. Tax is calculated at checkout.",
    url: `${BRAND_PUBLIC_URL}/pricing`,
    siteName: "NEXO Music Distribution",
    type: "website",
  },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string; checkout?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const catalog = publicBillingCatalog();
  const headerList = await headers();
  const country = countryFromTrustedHeaders(headerList);
  const token = getPaddleClientToken();
  const ctx = await getOptionalAuth();
  const accountType =
    billingAccountTypeFromRoles(ctx?.roles ?? [], ctx?.profile?.account_type) ??
    (sp.type === "label" ? "label" : "artist");
  const selection = parseBillingSelection({ plan: sp.plan, interval: sp.interval });
  const initialAccountType =
    selection && isPaidTierId(selection.planId)
      ? selection.planId.startsWith("label")
        ? "label"
        : "artist"
      : accountType;
  const autoCheckout =
    sp.checkout === "1" && selection && ctx?.userId ? selection.planId : null;

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Plans for artists and labels"
        description={`${COMPANY_LEGAL} publishes USD list prices plus approved Paddle country prices for the United Kingdom, Ireland, and Australia. Artist Starter is free. Paid plans include a 7-day trial. Tax is calculated by Paddle at checkout.`}
        crumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
      />

      <Section>
        <PricingTable
          initialCatalog={catalog}
          initialCountry={country}
          clientToken={token}
          auth={{
            signedIn: Boolean(ctx?.userId),
            email: ctx?.email ?? null,
            accountType: billingAccountTypeFromRoles(ctx?.roles ?? [], ctx?.profile?.account_type),
          }}
          initialAccountType={initialAccountType}
          initialInterval={selection?.interval ?? "month"}
          autoCheckoutPlan={autoCheckout}
        />
      </Section>

      <FinalCta
        title="Questions about distribution plans?"
        description="Start on Artist Starter at no cost, or subscribe to a paid plan. Paddle handles tax and checkout. Cancel or update payment details through the customer portal after you subscribe."
      />
    </>
  );
}
