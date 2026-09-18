import "server-only";

export const DISTRIBUTION_AGREEMENT_VERSION = "v1.1";
export const DISTRIBUTION_AGREEMENT_TEMPLATE_SHA256 =
  "c1e4f5253379e955c28943a8f31d3d333bd49e8cbbc8e7aba158f14a95c4b68d";

export const DISTRIBUTION_AGREEMENT_TITLE =
  "ARTIST & LABEL DIGITAL MUSIC DISTRIBUTION AGREEMENT";

export type AgreementExecutionSnapshot = {
  agreementId: string;
  accountType: "artist" | "label";
  legalName: string;
  displayName: string | null;
  accountId: string;
  verificationId: string;
  verifiedEmail: string;
  countryCode: string;
  paidPlan: boolean;
  planId: string | null;
  commissionBps: 1000 | 2000;
  clientSignedAt: string;
  verificationApprovedAt: string;
  companyAuthorizedAt: string;
  companyAuthorizedName: string;
  companyAuthorizedTitle: string;
  signatureMethod: "typed" | "drawn";
  signatureText?: string | null;
  signatureDataUrl?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
  executionHash: string;
};

export const AGREEMENT_DECLARATIONS = [
  "I confirm that my full legal name/legal entity name matches my approved verification record.",
  "I have read and agree to this Agreement and authorize NEXO MUSIC DISTRIBUTION LTD to distribute all content I submit under it.",
  "For every submission, I own or control 100% of the rights and authority necessary to grant Nexo the requested digital distribution and monetization rights, or I hold valid written authorization from all required rightsholders.",
  "I understand that artificial streaming, fraud and manipulated engagement are prohibited and may result in holds, withholding/retention of affected royalties, offsets, takedowns, account termination, repayment demands and lawful recovery action as described in Section 8.",
  "I understand the Free Plan carries a 20% Nexo commission and the Paid Plan carries a 10% Nexo commission on applicable distribution royalties.",
  "I consent to electronic signatures, electronic records and the capture of execution metadata for authentication and audit purposes.",
] as const;

export const AGREEMENT_SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "AGREEMENT AND PARTIES",
    body: [
      'This Artist & Label Digital Music Distribution Agreement ("Agreement") is entered into electronically on the date shown in the Execution Record between NEXO MUSIC DISTRIBUTION LTD, a Nigerian private limited company, RC 9253866 ("Nexo", "Distributor", "we", "us"), and the verified artist, label, rightsholder or authorized representative identified in the Execution Record ("Client", "you"). Nexo and Client are each a "Party" and together the "Parties".',
      "This Agreement applies to all sound recordings, releases, audiovisual music content, artwork and related materials that Client submits to Nexo for distribution during the Term. A separate paper schedule listing every track is not required. Each submission and its metadata becomes part of the distribution record for this Agreement.",
    ],
  },
  {
    heading: "1. CONDITION OF ACCESS; VERIFICATION",
    body: [
      "Client may execute this Agreement only after Nexo approves the applicable identity or business verification. Approval of verification does not waive Client's continuing obligation to provide accurate information or Nexo's right to request additional rights, identity, tax, banking, ownership or anti-fraud documentation where reasonably necessary.",
    ],
  },
  {
    heading: "2. APPOINTMENT AND DISTRIBUTION AUTHORITY",
    body: [
      "Client appoints Nexo during the Term as a non-exclusive digital distributor and administrator of the distribution rights Client grants under this Agreement. Client authorizes Nexo, directly or through approved delivery, technology, payment and platform partners, to ingest, encode, host, reproduce as technically necessary, deliver, distribute, make available, communicate, transmit, monetize, report on, administer, update and take down the submitted content through supported digital service providers, social/video platforms, download stores, streaming services and other digital outlets in territories supported by Nexo and its partners.",
      "This appointment is a limited distribution license only. Except for the rights expressly granted to perform the services, Nexo acquires no ownership interest in Client's master recordings.",
    ],
  },
  {
    heading: "3. CLIENT'S 100% DISTRIBUTION-RIGHTS WARRANTY",
    body: [
      "For every item submitted, Client represents and warrants that Client owns or validly controls 100% of the rights and authority necessary to authorize the requested digital distribution and monetization, or has obtained binding written authority from every person or entity whose consent is required. If Client is a label, manager or representative, Client warrants that its artist/rightsholder agreements authorize Client to grant Nexo the rights in this Agreement.",
      "This warranty does not mean that Client must personally own 100% of every underlying musical composition. Where a composition, beat, sample, feature, cover, artwork, name, likeness or other third-party material is used, Client must have all licenses, permissions and clearances required for the intended exploitation and must provide evidence when requested.",
    ],
  },
  {
    heading: "4. OWNERSHIP; MASTERS; PUBLISHING",
    body: [
      "Client retains its ownership of the master recordings and other Client-owned intellectual property. Publishing/composition rights are separate from master-distribution rights. This Agreement does not appoint Nexo Group Publishing as Client's publishing administrator and does not transfer songwriting or publishing rights. Any publishing administration must be governed by a separate written agreement.",
    ],
  },
  {
    heading: "5. TERRITORY AND OUTLETS",
    body: [
      "The distribution territory is worldwide to the extent supported by the applicable DSPs and Nexo's distribution infrastructure. Nexo may add, remove or change supported outlets as commercial relationships, technical capabilities, legal requirements or DSP policies change. Nexo does not guarantee acceptance, availability, editorial placement, playlisting, streams, revenue or continued availability at any DSP.",
    ],
  },
  {
    heading: "6. COMMERCIAL TERMS; ROYALTY COMMISSION",
    body: [
      "Free Plan: Nexo commission 20%; Client share 80%. Paid Plan: Nexo commission 10%; Client share 90%.",
      "The applicable commission is determined by Client's active Nexo plan for the royalty period or transaction to which the royalty relates. Nexo may deduct its applicable commission before crediting Client's balance. Taxes, DSP reversals, chargebacks, payment-provider charges, currency conversion, legally required withholding and other amounts expressly authorized by this Agreement may also affect the amount payable. Any future change to the 20% Free Plan or 10% Paid Plan commission must be communicated and applied in accordance with the amendment/change provisions of this Agreement; accrued royalties are not retroactively repriced unless required to correct an error, reversal or fraud.",
    ],
  },
  {
    heading: "7. ROYALTY REPORTING AND PAYMENTS",
    body: [
      "Nexo will account to Client based on royalty and usage data actually received or made available by DSPs and distribution partners. Statements may be delayed, corrected or restated when a DSP or partner supplies late or revised data. Payment is subject to Nexo's then-current supported payout methods, payout threshold (if any), completed tax/payment information, compliance review and the absence of a lawful or contractual hold.",
    ],
  },
  {
    heading: "8. ARTIFICIAL STREAMING, FRAUD AND ABUSE - ZERO TOLERANCE",
    body: [
      "Client shall not directly or indirectly create, purchase, encourage, arrange, facilitate or knowingly benefit from artificial, manipulated, fraudulent or non-genuine streaming, downloading, views, engagement, playlist activity, account activity, traffic or other conduct intended to improperly generate royalties, rankings, metrics or platform benefits. This includes bots, click farms, stream farms, compromised accounts, deceptive traffic, incentivized manipulation and services that guarantee or sell streams or engagement.",
      "Where Nexo has a reasonable, documented basis to suspect artificial streaming, fraud, rights infringement, identity abuse, material metadata deception or other prohibited activity, Nexo may place a temporary hold on affected royalties while investigating and may request information or supporting evidence. Where Nexo, a DSP, distribution partner, competent authority, or other reliable evidence confirms or reasonably substantiates prohibited activity, Nexo may, to the extent permitted by applicable law and the relevant platform/partner rules: (a) retain or withhold affected royalties; (b) offset confirmed losses, penalties, chargebacks, refunds, investigation costs and other amounts properly attributable to the misconduct against amounts otherwise payable to Client; (c) suspend or terminate the account and/or remove affected content; and (d) demand repayment of royalties previously paid to Client that are later reversed, charged back, forfeited or established to have resulted from prohibited activity.",
      "If Client fails to repay a properly documented amount when due, Nexo may pursue lawful recovery remedies, including civil legal proceedings. Nexo will not characterize legitimate royalties as forfeited merely because an investigation is pending; amounts unrelated to the suspected conduct should not be withheld longer than reasonably necessary unless required by a DSP, partner, court, regulator or applicable law.",
    ],
  },
  {
    heading: "9. CONTENT REVIEW, DSP RULES AND DELIVERY",
    body: [
      "Nexo may review submissions for technical, metadata, rights, fraud, safety and DSP-policy compliance. Nexo may reject, delay, request corrections to, or remove content that does not meet applicable requirements. DSPs retain independent discretion over acceptance and availability. Client must provide accurate titles, artists, contributors, ownership information, explicit-content flags, release dates, artwork, audio and identifiers.",
    ],
  },
  {
    heading: "10. ISRC, UPC/EAN AND CATALOG MIGRATION",
    body: [
      "Where Nexo assigns or administers identifiers, Client must use them consistently for the applicable recordings/releases. For previously released recordings, Client must disclose existing ISRCs, UPC/EANs, prior release dates and prior distributor information where requested. Nexo may preserve existing identifiers when appropriate and supported. Client remains responsible for the accuracy and legitimacy of supplied identifiers and migration information.",
    ],
  },
  {
    heading: "11. TAKEDOWNS, CLAIMS AND DISPUTES",
    body: [
      "Client may request takedowns subject to processing time and DSP/partner rules. Nexo may take down or restrict content in response to credible rights complaints, court orders, legal demands, DSP instructions, fraud findings or material breaches. Client must promptly cooperate with ownership and infringement investigations and provide contracts, licenses, split information, identification and other evidence reasonably requested.",
    ],
  },
  {
    heading: "12. TERM AND TERMINATION",
    body: [
      "This Agreement begins when electronically executed and continues until terminated. Either Party may terminate on thirty (30) days' written notice, subject to outstanding obligations and DSP processing times. Nexo may suspend services or terminate immediately for material breach, fraud, artificial streaming, infringement, unlawful activity, repeated DSP-policy violations, material misrepresentation, sanctions/compliance risk, or failure to cure a remediable breach after reasonable notice where cure is appropriate.",
      "Termination does not erase accrued payment, repayment, indemnity, confidentiality, audit, dispute, fraud, rights-clearance or other obligations that by their nature should survive. Nexo may continue receiving late DSP reports and money attributable to exploitation during the Term and will account for them subject to this Agreement.",
    ],
  },
  {
    heading: "13. TAX, PAYMENT AND ACCOUNT INFORMATION",
    body: [
      "Client is responsible for providing accurate payout, tax and beneficiary information and for Client's own taxes, except amounts Nexo is legally required to withhold or report. Nexo may delay payment where required information is incomplete, inconsistent with verification records, or reasonably raises compliance concerns.",
    ],
  },
  {
    heading: "14. CONFIDENTIALITY AND DATA",
    body: [
      "Each Party shall protect non-public commercial, financial, technical and personal information received from the other and use it for legitimate contractual, legal and operational purposes. Nexo may process and share necessary data with DSPs, payment providers, verification providers, professional advisers, technology vendors and authorities as reasonably necessary to provide services, enforce this Agreement, prevent fraud or comply with law, subject to applicable privacy requirements.",
    ],
  },
  {
    heading: "15. CLIENT INDEMNITY",
    body: [
      "To the extent permitted by law, Client shall defend, indemnify and hold harmless Nexo, its officers, employees and service providers from third-party claims, losses, damages, penalties and reasonable costs arising from Client's breach of this Agreement; unauthorized content; infringement or misappropriation; fraudulent/artificial activity attributable to Client or persons acting for Client; or materially false information supplied by Client, except to the extent caused by Nexo's own breach, negligence or willful misconduct.",
    ],
  },
  {
    heading: "16. LIMITATION OF LIABILITY",
    body: [
      "To the maximum extent permitted by applicable law, neither Party is liable to the other for indirect, incidental, special, exemplary or consequential damages arising solely from this Agreement, except where such limitation is prohibited by law or would improperly exclude liability for fraud, willful misconduct, confidentiality/data obligations, infringement, indemnity obligations or amounts actually due and payable.",
    ],
  },
  {
    heading: "17. FORCE MAJEURE",
    body: [
      "Neither Party is responsible for delay or failure caused by events beyond its reasonable control, including major network or infrastructure failures, DSP outages, governmental actions, natural disasters, war, civil disorder or similar events, provided the affected Party uses reasonable efforts to mitigate the impact.",
    ],
  },
  {
    heading: "18. NOTICES",
    body: [
      "Formal notices to Nexo may be sent to the official contact channel designated in Client's Nexo account or on nexomusicdistribution.com. Notices to Client may be sent to the verified email address associated with Client's account. Client must keep contact information current.",
    ],
  },
  {
    heading: "19. GOVERNING LAW AND DISPUTE RESOLUTION",
    body: [
      "This Agreement is governed by the laws of the Federal Republic of Nigeria, without prejudice to mandatory rights that cannot lawfully be waived. The Parties shall first attempt in good faith to resolve a dispute through written notice and reasonable negotiation. If unresolved, either Party may pursue available remedies before a court of competent jurisdiction in Lagos State, Nigeria, unless the Parties agree in writing to another lawful dispute-resolution process.",
    ],
  },
  {
    heading: "20. ENTIRE AGREEMENT; CHANGES; SEVERABILITY; ASSIGNMENT",
    body: [
      "This Agreement, together with incorporated plan terms and policies expressly identified to Client, constitutes the agreement concerning the distribution services described here. A material amendment will be communicated through an appropriate durable method and will take effect as stated in the notice, subject to applicable law. If a provision is unenforceable, the remainder continues in effect. Client may not assign this Agreement or transfer the account without Nexo's written consent, except as required by law. Nexo may assign this Agreement in connection with a merger, restructuring, sale of substantially all relevant business assets or successor operation, subject to applicable law.",
    ],
  },
];

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeAgreementLegalName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function renderSignedAgreementHtml(snapshot: AgreementExecutionSnapshot): string {
  const plan = snapshot.paidPlan
    ? "Paid Plan - 10% Nexo commission / 90% Client share"
    : "Free Plan - 20% Nexo commission / 80% Client share";
  const signature =
    snapshot.signatureMethod === "drawn" && snapshot.signatureDataUrl
      ? `<img src="${escapeHtml(snapshot.signatureDataUrl)}" alt="Client signature" style="max-width:320px;max-height:110px;display:block;margin-top:8px" />`
      : `<div style="font-family:cursive;font-size:26px;margin-top:8px">${escapeHtml(snapshot.signatureText)}</div>`;

  const sections = AGREEMENT_SECTIONS.map(
    (section) =>
      `<section><h2>${escapeHtml(section.heading)}</h2>${section.body
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("")}</section>`
  ).join("");

  const declarations = AGREEMENT_DECLARATIONS.map(
    (d) => `<li>✓ ${escapeHtml(d)}</li>`
  ).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Nexo Music Distribution Agreement ${escapeHtml(DISTRIBUTION_AGREEMENT_VERSION)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:0;padding:32px;line-height:1.55}
main{max-width:900px;margin:0 auto}.brand{border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:28px}
h1{font-size:28px;margin:0 0 8px}h2{font-size:16px;margin:28px 0 8px}p,li,td{font-size:13px}
table{width:100%;border-collapse:collapse;margin:18px 0}td{border:1px solid #bbb;padding:8px;vertical-align:top}
.audit{background:#f5f5f5;padding:18px;margin-top:28px}.hash{font-family:monospace;word-break:break-all}
.signature{min-height:120px}.small{font-size:11px;color:#555}@media print{body{padding:0}.no-print{display:none}}
</style></head><body><main>
<div class="brand"><h1>${escapeHtml(DISTRIBUTION_AGREEMENT_TITLE)}</h1>
<p><strong>NEXO MUSIC DISTRIBUTION LTD (RC 9253866)</strong><br>55 Moses Ajulo St, Ojokoro, Lagos, Nigeria 112104 · nexomusicdistribution.com</p>
<p>Agreement version: ${escapeHtml(DISTRIBUTION_AGREEMENT_VERSION)} · Template SHA-256: <span class="hash">${DISTRIBUTION_AGREEMENT_TEMPLATE_SHA256}</span></p></div>
${sections}
<section><h2>ELECTRONIC EXECUTION RECORD</h2>
<table>
<tr><td>Account type</td><td>${escapeHtml(snapshot.accountType)}</td></tr>
<tr><td>Client full legal name / legal entity name</td><td>${escapeHtml(snapshot.legalName)}</td></tr>
<tr><td>Stage / artist / label name</td><td>${escapeHtml(snapshot.displayName || "—")}</td></tr>
<tr><td>Nexo account ID</td><td>${escapeHtml(snapshot.accountId)}</td></tr>
<tr><td>Verification record ID</td><td>${escapeHtml(snapshot.verificationId)}</td></tr>
<tr><td>Verified email</td><td>${escapeHtml(snapshot.verifiedEmail)}</td></tr>
<tr><td>Country</td><td>${escapeHtml(snapshot.countryCode)}</td></tr>
<tr><td>Active plan at execution</td><td>${escapeHtml(plan)}${snapshot.planId ? ` · ${escapeHtml(snapshot.planId)}` : ""}</td></tr>
</table>
<h2>CLIENT DECLARATIONS</h2><ul>${declarations}</ul>
<table>
<tr><td><strong>CLIENT / ARTIST / LABEL</strong></td><td><strong>NEXO MUSIC DISTRIBUTION LTD</strong></td></tr>
<tr><td>Full legal name:<br><strong>${escapeHtml(snapshot.legalName)}</strong></td>
<td>Authorized for and on behalf of NEXO MUSIC DISTRIBUTION LTD<br><strong>${escapeHtml(snapshot.companyAuthorizedName)}</strong><br>${escapeHtml(snapshot.companyAuthorizedTitle)}</td></tr>
<tr><td class="signature">Signature:${signature}</td>
<td>Company execution:<br>Electronically pre-executed through Nexo's controlled company authorization record.<br><strong>Status: SIGNED BY NEXO</strong></td></tr>
</table></section>
<section class="audit"><h2>AUDIT TRAIL</h2>
<table>
<tr><td>Agreement/Audit ID</td><td>${escapeHtml(snapshot.agreementId)}</td></tr>
<tr><td>Client IP address</td><td>${escapeHtml(snapshot.clientIp || "not available")}</td></tr>
<tr><td>User agent/device record</td><td>${escapeHtml(snapshot.userAgent || "not available")}</td></tr>
<tr><td>Verification approval timestamp</td><td>${escapeHtml(snapshot.verificationApprovedAt)}</td></tr>
<tr><td>Client signature timestamp</td><td>${escapeHtml(snapshot.clientSignedAt)}</td></tr>
<tr><td>Nexo execution date/time</td><td>${escapeHtml(snapshot.companyAuthorizedAt)}</td></tr>
<tr><td>Execution SHA-256/hash</td><td class="hash">${escapeHtml(snapshot.executionHash)}</td></tr>
</table>
<p class="small">The execution hash covers the canonical agreement version, verified identity record, declarations, signature record, company authorization reference and execution timestamps stored by Nexo.</p></section>
</main></body></html>`;
}
