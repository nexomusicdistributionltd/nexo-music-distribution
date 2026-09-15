import {
  BRAND_LEGAL_NAME,
  BRAND_PUBLIC_URL,
  BRAND_SOCIAL_LINKS,
  BRAND_SUPPORT_EMAIL,
} from "@/lib/brand/social";
import { PUBLISHING_DIVISION } from "@/lib/site";
import type { LegalSection } from "@/components/legal/LegalArticle";

export const LEGAL_UPDATED = "15 September 2026";
export const LEGAL_CONTACT_EMAIL = BRAND_SUPPORT_EMAIL;
export const LEGAL_BUSINESS_NAME = BRAND_LEGAL_NAME;

const SITE = BRAND_PUBLIC_URL;
const SOCIAL_LIST = BRAND_SOCIAL_LINKS.map((s) => s.href).join(", ");

export const LEGAL_CONTACT_LINE = `Email ${LEGAL_CONTACT_EMAIL} or use the contact form at ${SITE}/contact.`;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Who we are",
    paragraphs: [
      `These Terms of Service (“Terms”) govern access to the websites, dashboards, APIs, and related services operated by ${LEGAL_BUSINESS_NAME} (“Nexo”, “we”, “us”). Our public website is ${SITE}. ${PUBLISHING_DIVISION} is our publishing division.`,
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
      "Approved Paddle country unit-price overrides (not a frontend currency conversion) are: United Kingdom (GBP) Artist Pro £7.99 / £79, Label Starter £15.99 / £159, Label Pro £39.99 / £399; Ireland (EUR) Artist Pro €9.49 / €94, Label Starter €18.99 / €189, Label Pro €47.99 / €479; Australia (AUD) Artist Pro A$14.99 / A$149, Label Starter A$29.99 / A$299, Label Pro A$74.99 / A$749. Monthly then annual. Other countries use the USD catalog price plus tax calculated by Paddle.",
      "Paid plans include a 7-day trial on monthly and annual intervals unless checkout displays a different trial. Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all paid orders: Paddle collects payment details, calculates applicable taxes, and issues invoices. Nexo does not receive or store raw payment card details.",
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
    heading: "14. Company details",
    paragraphs: [
      `${LEGAL_BUSINESS_NAME} operates the public website at ${SITE}. A registered office address, company number, and a specific governing-law or court venue are not published here because they are not recorded in this product’s verified company details. We do not invent those facts.`,
      "If official company records later publish a registered office or governing law, they will be added to this page. Until then, use the contact details below for notices and disputes.",
    ],
  },
  {
    heading: "15. Contact",
    paragraphs: [LEGAL_CONTACT_LINE],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Controller",
    paragraphs: [
      `${LEGAL_BUSINESS_NAME} is the controller of personal data processed through ${SITE} and the Nexo dashboards, except where Paddle acts as merchant of record for checkout, tax, and invoicing.`,
      LEGAL_CONTACT_LINE,
    ],
  },
  {
    heading: "2. Data we collect",
    paragraphs: [
      "We collect account data (name, email, country, artist or label profile), authentication data (including one-time login codes), catalog metadata and audio files you upload, support messages, newsletter subscriptions, and server logs needed to operate and secure the service.",
      "If you subscribe, checkout is conducted by Paddle.com as Merchant of Record. Paddle processes payment card and wallet details. Nexo does not receive or store raw payment card numbers. Nexo stores Paddle customer, subscription, and transaction identifiers needed to recognise your plan.",
    ],
  },
  {
    heading: "3. How we use data",
    paragraphs: [
      "We use personal data to create and secure accounts, deliver releases, calculate royalties from ingested reports, provide support, send transactional email, improve the product, and comply with law.",
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
      "Paddle.com Market Ltd and its affiliates act as Merchant of Record for paid orders and process checkout, tax, invoicing, and subscription data under Paddle’s own privacy notice. Hosting, database, and email delivery providers process data on our instructions. We require processors to protect data and use it only for the contracted purpose.",
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
      "We retain account and catalog records for as long as your workspace exists and for a reasonable period afterward for royalties, disputes, and legal holds. Paddle retains payment records according to its obligations as merchant of record. Webhook event identifiers are kept to process billing updates idempotently.",
    ],
  },
  {
    heading: "8. Security",
    paragraphs: [
      "We use access controls, encrypted transport, and role-based restrictions (including row-level security in our database) so users can read their own billing records and staff can administer finance. Payment secrets and webhook signing secrets are server-only.",
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
      `Cookies and similar technologies are described in our standalone Cookies Policy at ${SITE}/cookies. That page is part of this Privacy Policy for cookie-related processing.`,
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
      `${LEGAL_BUSINESS_NAME} supplies digital music-distribution software and related services. We do not ship physical goods. Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all paid orders.`,
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
      "This is not an absolute no-refunds policy. We review refund requests in good faith.",
      "We will consider a refund where there is a duplicate charge, a billing error, an unauthorised payment, where we failed to supply the subscribed service, or where a refund is required by applicable consumer law.",
      "Cancelling a subscription stops future renewals. Cancellation is not an automatic refund for time already used in a paid period, unless a review finds that a refund is due under the reasons above or the law.",
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
      `This Cookies Policy explains how ${LEGAL_BUSINESS_NAME} (“Nexo”, “we”) uses cookies and similar technologies on ${SITE} and on signed-in artist, label, and staff dashboards.`,
      `It should be read with our Privacy Policy at ${SITE}/privacy. Support: ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: "2. What cookies and similar technologies are",
    paragraphs: [
      "Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, session storage, and pixels or scripts that remember a browser or session.",
      "Cookies may be first-party (set by Nexo on nexomusicdistribution.com) or third-party (set by another domain when their service runs on a page, for example checkout or an embedded player).",
    ],
  },
  {
    heading: "3. Categories",
    paragraphs: [
      "We group cookies and similar technologies as follows. The later sections state which categories Nexo actually uses today. We do not invent trackers that are not in the product.",
    ],
    bullets: [
      "Essential — required to load the site, keep you signed in, complete security checks, or take payment. These are not used for advertising.",
      "Preference — remember choices such as appearance. Nexo stores theme preference in local storage, not as a first-party cookie.",
      "Analytics — measure how the public site is used. Nexo does not currently set a third-party analytics cookie or marketing measurement pixel on public pages.",
      "Marketing — advertising or retargeting. Nexo does not currently run marketing cookies or ad pixels.",
    ],
  },
  {
    heading: "4. What Nexo actually uses",
    paragraphs: [
      "After inspecting this application, the following first-party cookies and similar storage are in use. Names may include a project-specific prefix from our identity provider.",
    ],
    bullets: [
      "Supabase authentication cookies (typically named like sb-…-auth-token) so a signed-in session can continue across page loads. These are essential for artist, label, and staff dashboards. They are not set merely because you browse public pages such as Pricing or this Cookies Policy.",
      "nexo_otp_challenge — an HttpOnly cookie used only during email one-time-code login. It stores a challenge identifier (not the code itself) for about ten minutes, then expires or is cleared on logout.",
      "Theme preference — stored by the site’s theme library in the browser’s local storage (not a cookie) so light, dark, or system appearance can persist. Clearing site data resets appearance to the system default.",
    ],
  },
  {
    heading: "5. Analytics and marketing — not currently used",
    paragraphs: [
      "This website does not currently load Google Analytics, Meta Pixel, or another third-party advertising or analytics tag on public pages. Internal admin “analytics” screens show operational counts from our own database; they are not a public tracking cookie.",
      "We do not sell cookie data. If we later introduce optional analytics or marketing cookies, this Cookies Policy will be updated first and we will obtain consent where required.",
    ],
  },
  {
    heading: "6. Third parties",
    paragraphs: [
      "Some features run on other companies’ infrastructure. Those companies may set their own cookies when you use the feature. They are not Nexo first-party cookies.",
    ],
    bullets: [
      "Paddle.com — Merchant of Record for paid subscriptions. Overlay checkout and Paddle’s payment partners may set cookies to process payment, prevent fraud, and calculate tax. Those cookies are governed by Paddle’s notices.",
      "Supabase — hosts authentication and application data. Session cookies described above are issued as part of that identity service.",
      "YouTube privacy-enhanced embeds (youtube-nocookie.com) — used only when a public page includes a YouTube video we have chosen to embed. YouTube may set cookies when you play the video. We do not load a YouTube tag on every page.",
      "Official social profiles (Spotify, X, TikTok) listed from our brand social module are outbound links. Visiting those sites is subject to their own cookie policies. We do not set Facebook, Instagram, or LinkedIn cookies.",
    ],
  },
  {
    heading: "7. Newsletter and contact forms",
    paragraphs: [
      "Newsletter signup and contact forms submit the information you type. They do not require a non-essential tracking cookie. Transactional email (for example a login code) is sent to the address you provide.",
    ],
  },
  {
    heading: "8. How long cookies last",
    paragraphs: [
      "Session cookies last until you close the browser. Persistent authentication cookies last until they expire or you sign out. The OTP challenge cookie lasts about ten minutes. Paddle and YouTube cookies follow those providers’ rules.",
    ],
  },
  {
    heading: "9. How to control cookies",
    paragraphs: [
      "You can delete or block cookies in your browser settings (often under Privacy, Cookies, or Site data). You can also use private browsing. Blocking essential cookies will prevent sign-in, login codes, and Paddle checkout from working.",
      "Signed-out browsing of public pages — including Pricing, Terms of Service, Privacy Policy, Refund Policy, and this Cookies Policy — does not require an account cookie.",
      "Browser help: Chrome, Firefox, Safari, and Edge each publish their own cookie-control instructions. We do not override your browser’s cookie settings.",
    ],
  },
  {
    heading: "10. Relationship to the Privacy Policy",
    paragraphs: [
      `Personal data processed through cookies is also covered by the Privacy Policy at ${SITE}/privacy. If there is a conflict about cookies, this Cookies Policy describes the technologies; the Privacy Policy describes purposes, rights, and contact.`,
    ],
  },
  {
    heading: "11. Updates",
    paragraphs: [
      "We will post updates to this Cookies Policy with a new “last updated” date. Material changes will appear on this page before new optional cookies are introduced.",
    ],
  },
  {
    heading: "12. Contact",
    paragraphs: [
      LEGAL_CONTACT_LINE,
      `Public website: ${SITE}. Official social profiles: ${SOCIAL_LIST}.`,
    ],
  },
];
