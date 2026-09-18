export const DISTRIBUTION_AGREEMENT_VERSION = "v1.1";

export type DistributionAgreementSection = {
  heading: string;
  body: string;
};

export function distributionAgreementSections(input: {
  accountType: "artist" | "label";
  commissionBps: number;
}): DistributionAgreementSection[] {
  const commissionPercent = input.commissionBps / 100;
  const ownerPercent = 100 - commissionPercent;
  return [
    {
      heading: "1. Distribution authorization",
      body:
        "You authorize Nexo Music Distribution LTD to receive, process, quality-control, deliver, administer, monetize, report and manage the sound recordings and related assets that you submit through your Nexo account, including delivery to digital music services and approved distribution partners.",
    },
    {
      heading: "2. Ownership and authority",
      body:
        "You represent that you own or control 100% of the rights necessary for every recording, artwork, name, likeness, metadata and other asset you submit, or that you have written authority from the applicable rights owner. Nexo does not acquire ownership of your music merely because you distribute through Nexo.",
    },
    {
      heading: "3. Royalties and Nexo commission",
      body:
        `For the plan in effect when this agreement is signed, Nexo retains ${commissionPercent}% of master-distribution royalties attributable to your account and the account share is ${ownerPercent}%. Paid-plan accounts are subject to a 10% Nexo commission and free-plan accounts are subject to a 20% Nexo commission. Statements, reversals, store adjustments, taxes, chargebacks and legitimate third-party deductions may affect the amount ultimately available for payout.`,
    },
    {
      heading: "4. Fraudulent or artificial activity",
      body:
        "Artificial streaming, manipulated engagement, fraudulent transactions, unauthorized content, identity fraud, payment fraud or other abusive activity is prohibited. Where reasonably required to investigate or respond to such activity, Nexo may place funds on hold, withhold or offset royalties, suspend delivery, request takedowns, seek repayment of amounts already paid, preserve evidence and pursue available contractual or legal remedies.",
    },
    {
      heading: "5. Quality control and platform rules",
      body:
        "Every submission remains subject to Nexo quality control, metadata requirements, rights checks and the rules of the receiving platforms. Approval by Nexo does not guarantee that every service will accept, keep available or monetize a release.",
    },
    {
      heading: "6. Account, identity and payment information",
      body:
        "You agree to keep your identity, tax, payment and account information accurate and current. Nexo may request additional information where required for fraud prevention, rights verification, payment compliance, platform requirements or applicable law.",
    },
    {
      heading: "7. Statements and payouts",
      body:
        "Royalties become payable only after Nexo receives and reconciles the applicable reporting and funds. Payouts are subject to available balance, valid payout details, compliance review, applicable minimums and any legitimate holds, reversals or recoupments shown in the Nexo ledger.",
    },
    {
      heading: "8. Takedowns and continuing obligations",
      body:
        "You may request eligible takedowns through Nexo. Rights warranties, fraud obligations, payment adjustments, indemnity or repayment obligations, audit records and other provisions that by their nature must survive will continue after a release is removed or the account relationship ends.",
    },
    {
      heading: "9. Electronic acceptance",
      body:
        "By checking the declarations and typing your verified legal name, you intend to sign this agreement electronically. Nexo stores the agreement version, verified identity reference, acceptance time and a cryptographic hash of the executed agreement record.",
    },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildDistributionAgreementDocumentHtml(input: {
  legalName: string;
  accountType: "artist" | "label";
  email: string;
  countryCode: string;
  planId: string | null;
  commissionBps: number;
  signedAt: string;
  companyLegalName: string;
  companyAuthorizedName: string;
  companyAuthorizedTitle: string;
}): string {
  const sections = distributionAgreementSections({
    accountType: input.accountType,
    commissionBps: input.commissionBps,
  });
  const clauses = sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`
    )
    .join("");
  return [
    `<article data-agreement-version="${DISTRIBUTION_AGREEMENT_VERSION}">`,
    `<h1>Nexo Music Distribution Agreement ${DISTRIBUTION_AGREEMENT_VERSION}</h1>`,
    `<p>Company: ${escapeHtml(input.companyLegalName)}</p>`,
    `<p>Account type: ${escapeHtml(input.accountType)}</p>`,
    `<p>Client legal name: ${escapeHtml(input.legalName)}</p>`,
    `<p>Verified email: ${escapeHtml(input.email)}</p>`,
    `<p>Country: ${escapeHtml(input.countryCode)}</p>`,
    `<p>Plan: ${escapeHtml(input.planId ?? "free/grandfathered")}</p>`,
    clauses,
    `<section><h2>Nexo authorization</h2><p>${escapeHtml(input.companyAuthorizedName)}, ${escapeHtml(input.companyAuthorizedTitle)}, for ${escapeHtml(input.companyLegalName)}.</p></section>`,
    `<section><h2>Client electronic signature</h2><p>${escapeHtml(input.legalName)}</p><p>Signed at ${escapeHtml(input.signedAt)}</p></section>`,
    "</article>",
  ].join("");
}
