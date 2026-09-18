import "server-only";

import { createHash, createHmac } from "node:crypto";
import { getServiceRoleKey } from "@/lib/supabase/admin";

export const DISTRIBUTION_AGREEMENT_VERSION = "1.1";

export const DISTRIBUTION_AGREEMENT_TITLE =
  "NEXO MUSIC DISTRIBUTION LTD — Artist & Label Digital Music Distribution Agreement v1.1";

export type AgreementExecutionInput = {
  agreementId: string;
  userId: string;
  verificationId: string;
  accountType: "artist" | "label";
  legalName: string;
  displayName: string;
  email: string;
  countryCode: string;
  planId: string | null;
  commissionBps: 1000 | 2000;
  signatureMethod: "typed" | "drawn";
  signedAt: string;
  verificationApprovedAt: string;
  nexoExecutedAt: string;
  signerIp: string | null;
  userAgent: string | null;
};

export function normalizeLegalName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

export function legalNameMatches(entered: string, verified: string): boolean {
  return normalizeLegalName(entered) === normalizeLegalName(verified);
}

function signingSecret(): string {
  const dedicated = (process.env.NEXO_AGREEMENT_SIGNING_SECRET ?? "").trim();
  if (dedicated) return dedicated;
  const serviceRole = getServiceRoleKey();
  if (!serviceRole) {
    throw new Error("Server agreement signing credential is unavailable.");
  }
  return serviceRole;
}

export function createNexoExecutionSeal(input: AgreementExecutionInput): string {
  const canonical = [
    DISTRIBUTION_AGREEMENT_VERSION,
    input.agreementId,
    input.userId,
    input.verificationId,
    input.accountType,
    input.legalName,
    input.email,
    input.countryCode,
    input.planId ?? "",
    String(input.commissionBps),
    input.signatureMethod,
    input.signedAt,
    input.verificationApprovedAt,
    input.nexoExecutedAt,
  ].join("|");
  return createHmac("sha256", signingSecret()).update(canonical, "utf8").digest("hex");
}

const AGREEMENT_BODY: Array<[string, string]> = [
  [
    "AGREEMENT AND PARTIES",
    `This Artist & Label Digital Music Distribution Agreement ("Agreement") is entered into electronically on the date shown in the Execution Record between NEXO MUSIC DISTRIBUTION LTD, a Nigerian private limited company, RC 9253866 ("Nexo", "Distributor", "we", "us"), and the verified artist, label, rightsholder or authorized representative identified in the Execution Record ("Client", "you"). Nexo and Client are each a "Party" and together the "Parties". This Agreement applies to all sound recordings, releases, audiovisual music content, artwork and related materials that Client submits to Nexo for distribution during the Term. A separate paper schedule listing every track is not required. Each submission and its metadata becomes part of the distribution record for this Agreement.`,
  ],
  [
    "1. CONDITION OF ACCESS; VERIFICATION",
    `Client may execute this Agreement only after Nexo approves the applicable identity or business verification. Approval of verification does not waive Client's continuing obligation to provide accurate information or Nexo's right to request additional rights, identity, tax, banking, ownership or anti-fraud documentation where reasonably necessary.`,
  ],
  [
    "2. APPOINTMENT AND DISTRIBUTION AUTHORITY",
    `Client appoints Nexo during the Term as a non-exclusive digital distributor and administrator of the distribution rights Client grants under this Agreement. Client authorizes Nexo, directly or through approved delivery, technology, payment and platform partners, to ingest, encode, host, reproduce as technically necessary, deliver, distribute, make available, communicate, transmit, monetize, report on, administer, update and take down the submitted content through supported digital service providers, social/video platforms, download stores, streaming services and other digital outlets in territories supported by Nexo and its partners. This appointment is a limited distribution license only. Except for the rights expressly granted to perform the services, Nexo acquires no ownership interest in Client's master recordings.`,
  ],
  [
    "3. CLIENT'S 100% DISTRIBUTION-RIGHTS WARRANTY",
    `For every item submitted, Client represents and warrants that Client owns or validly controls 100% of the rights and authority necessary to authorize the requested digital distribution and monetization, or has obtained binding written authority from every person or entity whose consent is required. If Client is a label, manager or representative, Client warrants that its artist/rightsholder agreements authorize Client to grant Nexo the rights in this Agreement. This warranty does not mean that Client must personally own 100% of every underlying musical composition. Where a composition, beat, sample, feature, cover, artwork, name, likeness or other third-party material is used, Client must have all licenses, permissions and clearances required for the intended exploitation and must provide evidence when requested.`,
  ],
  [
    "4. OWNERSHIP; MASTERS; PUBLISHING",
    `Client retains its ownership of the master recordings and other Client-owned intellectual property. Publishing/composition rights are separate from master-distribution rights. This Agreement does not appoint Nexo Group Publishing as Client's publishing administrator and does not transfer songwriting or publishing rights. Any publishing administration must be governed by a separate written agreement.`,
  ],
  [
    "5. TERRITORY AND OUTLETS",
    `The distribution territory is worldwide to the extent supported by the applicable DSPs and Nexo's distribution infrastructure. Nexo may add, remove or change supported outlets as commercial relationships, technical capabilities, legal requirements or DSP policies change. Nexo does not guarantee acceptance, availability, editorial placement, playlisting, streams, revenue or continued availability at any DSP.`,
  ],
  [
    "6. COMMERCIAL TERMS; ROYALTY COMMISSION",
    `Free Plan: Nexo commission 20%; Client share 80%. Paid Plan: Nexo commission 10%; Client share 90%. The applicable commission is determined by Client's active Nexo plan for the royalty period or transaction to which the royalty relates. Nexo may deduct its applicable commission before crediting Client's balance. Taxes, DSP reversals, chargebacks, payment-provider charges, currency conversion, legally required withholding and other amounts expressly authorized by this Agreement may also affect the amount payable. Any future change to the 20% Free Plan or 10% Paid Plan commission must be communicated and applied in accordance with the amendment/change provisions of this Agreement; accrued royalties are not retroactively repriced unless required to correct an error, reversal or fraud.`,
  ],
  [
    "7. ROYALTY REPORTING AND PAYMENTS",
    `Nexo will account to Client based on royalty and usage data actually received or made available by DSPs and distribution partners. Statements may be delayed, corrected or restated when a DSP or partner supplies late or revised data. Payment is subject to Nexo's then-current supported payout methods, payout threshold (if any), completed tax/payment information, compliance review and the absence of a lawful or contractual hold.`,
  ],
  [
    "8. ARTIFICIAL STREAMING, FRAUD AND ABUSE — ZERO TOLERANCE",
    `Client shall not directly or indirectly create, purchase, encourage, arrange, facilitate or knowingly benefit from artificial, manipulated, fraudulent or non-genuine streaming, downloading, views, engagement, playlist activity, account activity, traffic or other conduct intended to improperly generate royalties, rankings, metrics or platform benefits. This includes bots, click farms, stream farms, compromised accounts, deceptive traffic, incentivized manipulation and services that guarantee or sell streams or engagement. Where Nexo has a reasonable, documented basis to suspect artificial streaming, fraud, rights infringement, identity abuse, material metadata deception or other prohibited activity, Nexo may place a temporary hold on affected royalties while investigating and may request information or supporting evidence. Where Nexo, a DSP, distribution partner, competent authority, or other reliable evidence confirms or reasonably substantiates prohibited activity, Nexo may, to the extent permitted by applicable law and the relevant platform/partner rules: (a) retain or withhold affected royalties; (b) offset confirmed losses, penalties, chargebacks, refunds, investigation costs and other amounts properly attributable to the misconduct against amounts otherwise payable to Client; (c) suspend or terminate the account and/or remove affected content; and (d) demand repayment of royalties previously paid to Client that are later reversed, charged back, forfeited or established to have resulted from prohibited activity. If Client fails to repay a properly documented amount when due, Nexo may pursue lawful recovery remedies, including civil legal proceedings. Nexo will not characterize legitimate royalties as forfeited merely because an investigation is pending; amounts unrelated to the suspected conduct should not be withheld longer than reasonably necessary unless required by a DSP, partner, court, regulator or applicable law.`,
  ],
  [
    "9. CONTENT REVIEW, DSP RULES AND DELIVERY",
    `Nexo may review submissions for technical, metadata, rights, fraud, safety and DSP-policy compliance. Nexo may reject, delay, request corrections to, or remove content that does not meet applicable requirements. DSPs retain independent discretion over acceptance and availability. Client must provide accurate titles, artists, contributors, ownership information, explicit-content flags, release dates, artwork, audio and identifiers.`,
  ],
  [
    "10. ISRC, UPC/EAN AND CATALOG MIGRATION",
    `Where Nexo assigns or administers identifiers, Client must use them consistently for the applicable recordings/releases. For previously released recordings, Client must disclose existing ISRCs, UPC/EANs, prior release dates and prior distributor information where requested. Nexo may preserve existing identifiers when appropriate and supported. Client remains responsible for the accuracy and legitimacy of supplied identifiers and migration information.`,
  ],
  [
    "11. TAKEDOWNS, CLAIMS AND DISPUTES",
    `Client may request takedowns subject to processing time and DSP/partner rules. Nexo may take down or restrict content in response to credible rights complaints, court orders, legal demands, DSP instructions, fraud findings or material breaches. Client must promptly cooperate with ownership and infringement investigations and provide contracts, licenses, split information, identification and other evidence reasonably requested.`,
  ],
  [
    "12. TERM AND TERMINATION",
    `This Agreement begins when electronically executed and continues until terminated. Either Party may terminate on thirty (30) days' written notice, subject to outstanding obligations and DSP processing times. Nexo may suspend services or terminate immediately for material breach, fraud, artificial streaming, infringement, unlawful activity, repeated DSP-policy violations, material misrepresentation, sanctions/compliance risk, or failure to cure a remediable breach after reasonable notice where cure is appropriate. Termination does not erase accrued payment, repayment, indemnity, confidentiality, audit, dispute, fraud, rights-clearance or other obligations that by their nature should survive. Nexo may continue receiving late DSP reports and money attributable to exploitation during the Term and will account for them subject to this Agreement.`,
  ],
  [
    "13. TAX, PAYMENT AND ACCOUNT INFORMATION",
    `Client is responsible for providing accurate payout, tax and beneficiary information and for Client's own taxes, except amounts Nexo is legally required to withhold or report. Nexo may delay payment where required information is incomplete, inconsistent with verification records, or reasonably raises compliance concerns.`,
  ],
  [
    "14. CONFIDENTIALITY AND DATA",
    `Each Party shall protect non-public commercial, financial, technical and personal information received from the other and use it for legitimate contractual, legal and operational purposes. Nexo may process and share necessary data with DSPs, payment providers, verification providers, professional advisers, technology vendors and authorities as reasonably necessary to provide services, enforce this Agreement, prevent fraud or comply with law, subject to applicable privacy requirements.`,
  ],
  [
    "15. CLIENT INDEMNITY",
    `To the extent permitted by law, Client shall defend, indemnify and hold harmless Nexo, its officers, employees and service providers from third-party claims, losses, damages, penalties and reasonable costs arising from Client's breach of this Agreement; unauthorized content; infringement or misappropriation; fraudulent/artificial activity attributable to Client or persons acting for Client; or materially false information supplied by Client, except to the extent caused by Nexo's own breach, negligence or willful misconduct.`,
  ],
  [
    "16. LIMITATION OF LIABILITY",
    `To the maximum extent permitted by applicable law, neither Party is liable to the other for indirect, incidental, special, exemplary or consequential damages arising solely from this Agreement, except where such limitation is prohibited by law or would improperly exclude liability for fraud, willful misconduct, confidentiality/data obligations, infringement, indemnity obligations or amounts actually due and payable.`,
  ],
  [
    "17. FORCE MAJEURE",
    `Neither Party is responsible for delay or failure caused by events beyond its reasonable control, including major network or infrastructure failures, DSP outages, governmental actions, natural disasters, war, civil disorder or similar events, provided the affected Party uses reasonable efforts to mitigate the impact.`,
  ],
  [
    "18. NOTICES",
    `Formal notices to Nexo may be sent to the official contact channel designated in Client's Nexo account or on nexomusicdistribution.com. Notices to Client may be sent to the verified email address associated with Client's account. Client must keep contact information current.`,
  ],
  [
    "19. GOVERNING LAW AND DISPUTE RESOLUTION",
    `This Agreement is governed by the laws of the Federal Republic of Nigeria, without prejudice to mandatory rights that cannot lawfully be waived. The Parties shall first attempt in good faith to resolve a dispute through written notice and reasonable negotiation. If unresolved, either Party may pursue available remedies before a court of competent jurisdiction in Lagos State, Nigeria, unless the Parties agree in writing to another lawful dispute-resolution process.`,
  ],
  [
    "20. ENTIRE AGREEMENT; CHANGES; SEVERABILITY; ASSIGNMENT",
    `This Agreement, together with incorporated plan terms and policies expressly identified to Client, constitutes the agreement concerning the distribution services described here. A material amendment will be communicated through an appropriate durable method and will take effect as stated in the notice, subject to applicable law. If a provision is unenforceable, the remainder continues in effect. Client may not assign this Agreement or transfer the account without Nexo's written consent, except as required by law. Nexo may assign this Agreement in connection with a merger, restructuring, sale of substantially all relevant business assets or successor operation, subject to applicable law.`,
  ],
];

export function agreementBodySections(): ReadonlyArray<readonly [string, string]> {
  return AGREEMENT_BODY;
}

function ascii(value: string): string {
  return value
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrap(text: string, width = 92): string[] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfEscape(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]): Buffer {
  const perPage = 58;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjectNumbers.push(4 + i * 2);
    contentObjectNumbers.push(5 + i * 2);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((page, index) => {
    const pageNo = pageObjectNumbers[index];
    const contentNo = contentObjectNumbers[index];
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>`;
    const commands = [
      "BT",
      "/F1 8.5 Tf",
      "11 TL",
      "45 800 Td",
      ...page.map((line, i) => `${i === 0 ? "" : "T* " }(${pdfEscape(line)}) Tj`),
      "ET",
    ].join("\n");
    objects[contentNo] = `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}\nendstream`;
  });

  const maxObject = Math.max(...Object.keys(objects).map(Number));
  let output = "%PDF-1.4\n%NEXO\n";
  const offsets: number[] = new Array(maxObject + 1).fill(0);
  for (let i = 1; i <= maxObject; i++) {
    offsets[i] = Buffer.byteLength(output, "latin1");
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObject; i++) {
    output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}

export function buildExecutedAgreementPdf(input: AgreementExecutionInput): {
  pdf: Buffer;
  sha256: string;
  executionSeal: string;
} {
  const executionSeal = createNexoExecutionSeal(input);
  const clientShare = input.commissionBps === 1000 ? "90%" : "80%";
  const planLabel = input.commissionBps === 1000 ? "Paid Plan" : "Free Plan";
  const lines: string[] = [
    DISTRIBUTION_AGREEMENT_TITLE,
    "NEXO MUSIC DISTRIBUTION LTD (RC 9253866) | 55 Moses Ajulo St, Ojokoro, Lagos, Nigeria 112104 | nexomusicdistribution.com",
    "",
  ];

  for (const [heading, body] of AGREEMENT_BODY) {
    lines.push(heading);
    lines.push(...wrap(body));
    lines.push("");
  }

  lines.push("ELECTRONIC EXECUTION RECORD");
  lines.push(`Account type: ${input.accountType === "label" ? "Label" : "Artist"}`);
  lines.push(`Client full legal name / legal entity name: ${input.legalName}`);
  lines.push(`Stage / artist / label name: ${input.displayName}`);
  lines.push(`Nexo account ID: ${input.userId}`);
  lines.push(`Verification record ID: ${input.verificationId}`);
  lines.push(`Verified email: ${input.email}`);
  lines.push(`Country: ${input.countryCode}`);
  lines.push(`Active plan at execution: ${planLabel}; Nexo commission ${input.commissionBps / 100}%; Client share ${clientShare}`);
  lines.push("");
  lines.push("CLIENT DECLARATIONS");
  lines.push("[X] My full legal name/legal entity name matches my approved verification record.");
  lines.push("[X] I have read and agree to this Agreement and authorize NEXO MUSIC DISTRIBUTION LTD to distribute all content I submit under it.");
  lines.push("[X] For every submission, I own or control 100% of the rights and authority necessary to grant the requested distribution and monetization rights, or hold valid written authorization.");
  lines.push("[X] I understand artificial streaming, fraud and manipulated engagement are prohibited and may result in holds, withholding/retention of affected royalties, offsets, takedowns, termination, repayment demands and lawful recovery action as described in Section 8.");
  lines.push("[X] I understand the Free Plan carries a 20% Nexo commission and the Paid Plan carries a 10% Nexo commission on applicable distribution royalties.");
  lines.push("[X] I consent to electronic signatures, electronic records and capture of execution metadata for authentication and audit purposes.");
  lines.push("");
  lines.push("CLIENT / ARTIST / LABEL");
  lines.push(`Full legal name: ${input.legalName}`);
  lines.push(`Signature method: ${input.signatureMethod === "drawn" ? "Live drawn signature" : "Typed legal-name signature"}`);
  lines.push(`Client signature timestamp: ${input.signedAt}`);
  lines.push("");
  lines.push("NEXO MUSIC DISTRIBUTION LTD");
  lines.push("Authorized for and on behalf of NEXO MUSIC DISTRIBUTION LTD");
  lines.push("ADEMONRIN SAMUEL KAYODE — Founder");
  lines.push("Company execution: Electronically pre-executed by NEXO MUSIC DISTRIBUTION LTD through the authenticated server-side execution workflow.");
  lines.push(`Nexo execution date/time: ${input.nexoExecutedAt}`);
  lines.push(`Nexo server execution seal (HMAC-SHA256): ${executionSeal}`);
  lines.push("");
  lines.push("AUDIT TRAIL");
  lines.push(`Agreement/Audit ID: ${input.agreementId}`);
  lines.push(`Client IP address: ${input.signerIp ?? "not available"}`);
  lines.push(`User agent/device record: ${input.userAgent ?? "not available"}`);
  lines.push(`Verification approval timestamp: ${input.verificationApprovedAt}`);
  lines.push(`Client signature timestamp: ${input.signedAt}`);
  lines.push("Final document SHA-256: stored with this agreement record after document sealing.");

  const pdf = buildPdf(lines);
  return {
    pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"),
    executionSeal,
  };
}
