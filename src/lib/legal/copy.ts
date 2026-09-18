import { BRAND_PUBLIC_URL, BRAND_SOCIAL_LINKS } from "@/lib/brand/social";
import { INQUIRIES_EMAIL, PRIMARY_CONTACT_EMAIL } from "@/lib/brand/contact";
import { COMPANY_LEGAL, PUBLISHING_DIVISION } from "@/lib/site";
import type { LegalSection } from "@/components/legal/LegalArticle";

export const LEGAL_UPDATED = "18 September 2026";
export const LEGAL_CONTACT_EMAIL = PRIMARY_CONTACT_EMAIL;
export const LEGAL_INQUIRIES_EMAIL = INQUIRIES_EMAIL;

const SITE = BRAND_PUBLIC_URL;
const SOCIAL_LIST = BRAND_SOCIAL_LINKS.map((s) => s.href).join(", ");

export const LEGAL_CONTACT_LINE = `Email ${LEGAL_CONTACT_EMAIL} or use the contact form at ${SITE}/contact. Additional inquiries: ${LEGAL_INQUIRIES_EMAIL}.`;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Who we are",
    paragraphs: [
      `These Terms of Service (“Terms”) govern access to the websites, dashboards, APIs, and related services operated by ${COMPANY_LEGAL} (“Nexo”, “we”, “us”). Our public website is ${SITE}. ${PUBLISHING_DIVISION} is our publishing division.`,
      `Official public profiles are listed at ${SITE} and include ${SOCIAL_LIST}. Support mail is ${LEGAL_CONTACT_EMAIL}.`,
      "By creating an account, submitting a release, browsing the public site, or purchasing a subscription, you agree to these Terms. If you use Nexo on behalf of a label or other organisation, you represent that you have authority to bind that organisation.",
    ],
  },
  {
    heading: "2. Accounts and eligibility",
    paragraphs: [
      "You must provide accurate registration information and keep your login credentials confidential. Artist and label accounts are separate product roles. You may not impersonate another rights holder or register privileged staff roles through self-service signup.",
      "We may suspend or restrict accounts that fail verification, violate these Terms, or present a legal, fraud, or quality-control risk. Existing catalog data is not deleted solely because a subscription changes.",
    ],
  },
  {
    heading: "3. Distribution and publishing services",
    paragraphs: [
      "Nexo provides digital music distribution, royalty reporting workflows, and publishing-administration support. Storefront acceptance, playlist placement, and third-party DSP policies are outside our control. We do not guarantee that any platform will ingest, keep, or promote a release.",
      `${PUBLISHING_DIVISION} offerings (including sync pathways, mechanical administration support, and statements) are described on the site without inventing collecting-society or DSP relationships. Where a capability is unavailable, the product will say so rather than fabricate a connection.`,
    ],
  },
  {
    heading: "4. Your content and rights warranties",
    paragraphs: [
      "You retain ownership of your recordings, compositions, artwork, and metadata. You grant Nexo a limited licence to encode, deliver, store, and display that content as required to operate distribution and the public catalog features you enable.",
      "You warrant that you control or are licensed to distribute the sound recordings and, where applicable, the underlying musical works; that samples and featured performances are cleared; and that metadata (including ISRC, UPC, contributors, and explicit lyrics flags) is accurate.",
    ],
  },
  {
    heading: "5. Subscriptions and billing",
    paragraphs: [
      "Artist Starter is free and does not create a Paddle subscription. Artist Pro, Label Starter, and Label Pro are paid subscriptions. Published USD list prices are: Artist Pro $9.99 per month or $99 per year; Label Starter $19.99 per month or $199 per year; Label Pro $49.99 per month or $499 per year.",
      "Paid plans include a 7-day trial on monthly and annual intervals unless checkout displays a different trial. Paddle is the merchant of record: it collects payment details, calculates applicable taxes, and issues invoices. Localized totals at checkout may differ from USD list prices because of tax and currency conversion.",
      "Paid access is granted only after Paddle confirms the subscription (typically via a verified webhook). Completing the checkout overlay on your device is not by itself a grant of entitlements. You authorise recurring billing until you cancel.",
    ],
  },
  {
    heading: "6. Cancellation and customer portal",
    paragraphs: [
      "You may cancel or update payment methods through the Paddle customer portal linked from your Nexo Billing page. When you schedule cancellation at period end, access continues until the scheduled change takes effect. Immediate cancellation, pauses, and past-due states follow Paddle’s subscription status.",
      "We do not accept a Paddle customer ID from the browser. Portal sessions are created on the server from the customer ID stored for your account.",
    ],
  },
  {
    heading: "7. Refunds",
    paragraphs: [
      `Digital subscription services are supplied when a trial starts or payment is confirmed. Refunds are described in our Refund Policy at ${SITE}/refund-policy. Chargebacks initiated without contacting us may result in account restriction while we investigate.`,
    ],
  },
  {
    heading: "8. Acceptable use",
    paragraphs: [
      "You may not use Nexo to distribute infringing, fraudulent, or unlawful content; attempt to bypass quality control; attack our systems; scrape other users’ data; or resell the service without permission.",
    ],
    bullets: [
      "No unauthorised access to staff tools, webhooks, or other users’ billing records.",
      "No uploading malware, scraped catalogs you do not control, or deceptive metadata.",
      "No interference with royalty ledgers, payouts, or DDEX deliveries.",
    ],
  },
  {
    heading: "9. Quality control and takedowns",
    paragraphs: [
      "Releases may be held, rejected, or taken down for metadata, audio, artwork, rights, or storefront-policy reasons. If we receive a valid rights complaint, we may disable delivery while the claim is reviewed. You agree to cooperate with reasonable documentation requests.",
    ],
  },
  {
    heading: "10. Royalties and payouts",
    paragraphs: [
      "Royalty figures in the dashboard come from ingested statements and the ledger. We do not invent balances. Payout execution depends on a connected payment provider; until that provider is connected, payouts remain unavailable rather than marked paid.",
    ],
  },
  {
    heading: "11. Privacy",
    paragraphs: [
      `How we process personal data is described in the Privacy Policy at ${SITE}/privacy. Paddle processes checkout and tax data as merchant of record according to Paddle’s own notices.`,
    ],
  },
  {
    heading: "12. Disclaimers and liability",
    paragraphs: [
      "The service is provided on an as-available basis. To the fullest extent permitted by law, Nexo is not liable for lost profits, lost catalog opportunities, DSP rejections, or indirect damages. Our aggregate liability arising from these Terms is limited to the greater of (a) the subscription fees you paid to Paddle for Nexo plans in the three months before the claim or (b) one hundred US dollars, except where liability cannot be limited (including for fraud or personal injury).",
    ],
  },
  {
    heading: "13. Changes",
    paragraphs: [
      "We may update these Terms. Material changes will be posted on this page with a new “last updated” date. Continued use after the effective date constitutes acceptance of the updated Terms.",
    ],
  },
  {
    heading: "14. Contact",
    paragraphs: [LEGAL_CONTACT_LINE],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Controller",
    paragraphs: [
      `${COMPANY_LEGAL} is the controller of personal data processed through ${SITE} and the Nexo dashboards, except where Paddle acts as merchant of record for checkout, tax, and invoicing.`,
      LEGAL_CONTACT_LINE,
    ],
  },
  {
    heading: "2. Data we collect",
    paragraphs: [
      "We collect account data (name, email, country, artist or label profile), authentication data (including one-time login codes), catalog metadata and audio files you upload, support messages, newsletter subscriptions, and server logs needed to operate and secure the service.",
      "For mandatory artist and label identity verification, we collect the legal name, date of birth, country, document type, live camera images of the front and back of the identity document, and a live face image. Verification evidence is treated as sensitive account-security data and is not displayed publicly.",
      "If you subscribe, Paddle processes payment card or wallet details. Nexo stores Paddle customer, subscription, and transaction identifiers needed to recognise your plan. We do not store full card numbers.",
    ],
  },
  {
    heading: "3. How we use data",
    paragraphs: [
      "We use personal data to create and secure accounts, verify artist and label identities, detect duplicate or potentially fraudulent verification evidence, deliver releases, calculate royalties from ingested reports, provide support, send transactional email, improve the product, resolve disputes, and comply with law.",
    ],
    bullets: [
      "Contract: operating your artist or label workspace and any paid subscription.",
      "Legitimate interests: securing the service, preventing fraud, and understanding aggregated product usage.",
      "Consent: marketing email where required. You may unsubscribe.",
      "Legal obligation: tax, accounting, and rights-complaint records.",
    ],
  },
  {
    heading: "4. Paddle and other processors",
    paragraphs: [
      "Paddle.com Market Ltd and its affiliates process checkout, tax, invoicing, and subscription data. Hosting, database, and email delivery providers process data on our instructions. We require processors to protect data and use it only for the contracted purpose.",
    ],
  },
  {
    heading: "5. Sharing",
    paragraphs: [
      "We share release metadata and assets with digital service providers as required to distribute your music. We may share data with professional advisers, or if required by law, a rights complaint, or a corporate transaction. We do not sell personal data.",
    ],
  },
  {
    heading: "6. International transfers",
    paragraphs: [
      "Your data may be processed in the United Kingdom, the European Economic Area, the United States, and other countries where our processors operate. Where required, we use appropriate transfer safeguards.",
    ],
  },
  {
    heading: "7. Retention",
    paragraphs: [
      "We retain account and catalog records for as long as your workspace exists and for a reasonable period afterward for royalties, disputes, fraud prevention, security investigations, and legal holds. Identity-verification evidence may be retained while the account exists and afterward where reasonably necessary for fraud prevention, compliance, disputes, or legal obligations. Paddle retains payment records according to its obligations as merchant of record. Webhook event identifiers are kept to process billing updates idempotently.",
    ],
  },
  {
    heading: "8. Security",
    paragraphs: [
      "We use access controls, encrypted transport, and role-based restrictions (including row-level security in our database). Identity documents and face captures are stored in a private access-controlled bucket; staff access is limited to verification review and operational security. Payment secrets and webhook signing secrets are server-only.",
    ],
  },
  {
    heading: "9. Your rights",
    paragraphs: [
      "Depending on your location you may have rights to access, correct, delete, or restrict processing of your personal data, to object to certain processing, and to data portability. You may also lodge a complaint with a supervisory authority. Email us or use the contact page to make a request. We may need to verify your identity.",
    ],
  },
  {
    heading: "10. Children",
    paragraphs: [
      "Nexo is intended for adult rights holders and organisations. We do not knowingly collect personal data from children for account registration.",
    ],
  },
  {
    heading: "11. Cookies",
    paragraphs: [
      `See ${SITE}/cookies for cookies and similar technologies used on the public site and dashboards.`,
    ],
  },
  {
    heading: "12. Official channels",
    paragraphs: [
      `Public website: ${SITE}. Support: ${LEGAL_CONTACT_EMAIL}. Official social profiles: ${SOCIAL_LIST}. We do not operate other social accounts as official Nexo channels.`,
    ],
  },
  {
    heading: "13. Changes",
    paragraphs: [
      "We will post updates to this Privacy Policy with a new “last updated” date.",
    ],
  },
];

export const REFUND_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Digital services",
    paragraphs: [
      `${COMPANY_LEGAL} supplies digital music-distribution software and related services. We do not ship physical goods. Paid subscriptions are sold through Paddle, which is the merchant of record for payment, tax, and invoicing.`,
    ],
  },
  {
    heading: "2. Trials",
    paragraphs: [
      "Paid Artist Pro, Label Starter, and Label Pro plans include a 7-day trial on monthly and annual intervals unless checkout shows a different trial. You can cancel during the trial via the Paddle customer portal before you are billed. Trial access is confirmed by Paddle, not by the checkout overlay alone.",
    ],
  },
  {
    heading: "3. Cancellation",
    paragraphs: [
      "Cancel from your Nexo Billing page using Manage billing, which opens an authenticated Paddle customer portal session. If you cancel at period end, you keep access until that date. We do not delete your catalog, releases, or royalty history when a subscription is canceled, paused, or past due.",
    ],
  },
  {
    heading: "4. Refunds",
    paragraphs: [
      "Because the service is digital and provisioned when Paddle confirms the subscription, fees for completed billing periods are generally non-refundable. We will consider refund requests where required by applicable consumer law, where Paddle could not complete checkout, or where we failed to supply the subscribed service.",
      "Refunds, when approved, are processed by Paddle to the original payment method. Tax treatment of refunds follows Paddle’s invoicing.",
    ],
  },
  {
    heading: "5. How to request a refund",
    paragraphs: [
      `Email ${LEGAL_CONTACT_EMAIL} or write via ${SITE}/contact with your account email, Paddle transaction or subscription ID (from Billing, if you have one), and the reason for the request. Do not send card numbers.`,
      "We may decline requests that follow chargebacks opened without first contacting us, or that relate to DSP editorial decisions, playlist outcomes, or delays caused by incomplete metadata.",
    ],
  },
  {
    heading: "6. Chargebacks",
    paragraphs: [
      "If you dispute a charge with your bank, we and Paddle may pause distribution tools on the account until the dispute is resolved. Contact us first so we can help cancel or refund where appropriate.",
    ],
  },
  {
    heading: "7. Free Artist Starter",
    paragraphs: [
      "Artist Starter has no Paddle subscription and no subscription fee to refund.",
    ],
  },
  {
    heading: "8. Contact",
    paragraphs: [LEGAL_CONTACT_LINE],
  },
];

/** @deprecated alias — canonical public URL is /refund-policy */
export const RETURN_POLICY_SECTIONS = REFUND_POLICY_SECTIONS;

export const COOKIES_SECTIONS: LegalSection[] = [
  {
    heading: "1. Who we are",
    paragraphs: [
      `This Cookie Policy explains how ${COMPANY_LEGAL} uses cookies and similar technologies on ${SITE} and signed-in dashboards.`,
      LEGAL_CONTACT_LINE,
    ],
  },
  {
    heading: "2. What cookies are",
    paragraphs: [
      "Cookies are small text files stored on your device. Similar technologies include local storage and pixels that remember a browser or session. Some cookies are essential for the site to function; others are optional.",
    ],
  },
  {
    heading: "3. Essential cookies we use",
    paragraphs: [
      "We set cookies that are required to operate the service. These are not used for advertising.",
    ],
    bullets: [
      "Authentication cookies issued by our identity provider so you can stay signed in to artist, label, and staff workspaces.",
      "Security cookies that protect forms and sessions against abuse.",
      "Load-balancing or hosting cookies required to deliver the website reliably.",
    ],
  },
  {
    heading: "4. Preferences stored on your device",
    paragraphs: [
      "Theme preference (light, dark, or system) is stored in your browser’s local storage rather than as a first-party cookie. Clearing site data will reset appearance to the system default.",
    ],
  },
  {
    heading: "5. Checkout and payments (Paddle)",
    paragraphs: [
      "When you start a paid subscription, checkout is provided by Paddle as merchant of record. Paddle and its payment partners may set cookies or similar technologies on checkout pages (including overlay checkout) to process payment, prevent fraud, and calculate tax. Those technologies are governed by Paddle’s own notices.",
    ],
  },
  {
    heading: "6. Analytics and advertising",
    paragraphs: [
      "This website does not currently run a third-party advertising network or a marketing pixel on public pages. We do not sell cookie data. If we introduce optional analytics cookies later, this policy will be updated before those cookies are set, and we will obtain consent where required.",
    ],
  },
  {
    heading: "7. Newsletter and contact forms",
    paragraphs: [
      "Newsletter signup and contact forms submit the information you enter. They do not require a non-essential tracking cookie. Transactional email (for example login codes) is sent to the address you provide.",
    ],
  },
  {
    heading: "8. How long cookies last",
    paragraphs: [
      "Session cookies expire when you close the browser. Persistent authentication cookies last until they expire or you sign out. Paddle checkout cookies follow Paddle’s retention rules.",
    ],
  },
  {
    heading: "9. Managing cookies",
    paragraphs: [
      "You can delete or block cookies in your browser settings. Blocking essential cookies will prevent sign-in and checkout from working. Signed-out browsing of public pages such as Pricing, Terms, Privacy, Refund Policy, and this Cookie Policy does not require an account cookie.",
    ],
  },
  {
    heading: "10. Official channels",
    paragraphs: [
      `Public website: ${SITE}. Support: ${LEGAL_CONTACT_EMAIL}. Official social profiles: ${SOCIAL_LIST}.`,
    ],
  },
  {
    heading: "11. Changes",
    paragraphs: [
      "We will post updates to this Cookie Policy with a new “last updated” date.",
    ],
  },
];
