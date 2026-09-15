import "server-only";

import nodemailer from "nodemailer";

/**
 * Nexo Zoho Mail SMTP transport (newsletter / outbound / admin compose).
 * Canonical live Auth SMTP: smtp.zoho.com:465 (Zoho Mail SMTP — do not invent other hosts).
 * Public brand URL is https://nexomusicdistribution.com (site, CTA, email HTML).
 * SMTP From is env-driven (`EMAIL_FROM`); default remains the Zoho-verified mailbox
 * contact@nexomusicdistro.space. Do not change SMTP_USER / this default to a .com
 * address unless ops has verified that From domain in Zoho Mail.
 * Never fakes success — callers must treat missing messageId as failure.
 * This is the ONLY outbound SMTP transporter. Do not add another createTransport.
 */

export const DEFAULT_EMAIL_FROM =
  "Nexo Music Distribution LTD <contact@nexomusicdistro.space>";

/** Zoho Mail SMTP host when ZOHO_SMTP_APP_PASSWORD is set and SMTP_HOST is empty. */
export const ZOHO_MAIL_SMTP_HOST = "smtp.zoho.com";

/** Zoho Mail IMAP (inbound). Same mailbox credentials as SMTP; not a second SMTP transport. */
export const ZOHO_MAIL_IMAP_HOST = "imap.zoho.com";

export type ZohoSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export type ZohoMailAuth = {
  user: string;
  password: string;
};

export type ZohoSmtpAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
};

function resolvePassword(): string {
  return (
    (process.env.SMTP_PASSWORD ?? "").trim() ||
    (process.env.SMTP_PASS ?? "").trim() ||
    (process.env.ZOHO_SMTP_APP_PASSWORD ?? "").trim()
  );
}

export function resolveZohoSmtpConfig(): ZohoSmtpConfig | null {
  const zohoAppPassword = (process.env.ZOHO_SMTP_APP_PASSWORD ?? "").trim();
  let host = (process.env.SMTP_HOST ?? "").trim();
  // If ops stores ZOHO_SMTP_APP_PASSWORD and leaves SMTP_HOST empty, use Zoho Mail SMTP.
  if (!host && zohoAppPassword) {
    host = ZOHO_MAIL_SMTP_HOST;
  }

  const user = (process.env.SMTP_USER ?? "").trim();
  const password = resolvePassword();
  if (!host || !user || !password) return null;

  const portRaw = (process.env.SMTP_PORT ?? "").trim();
  let port = portRaw ? Number(portRaw) : NaN;
  let secure: boolean;
  if (Number.isFinite(port) && port > 0) {
    secure = port === 465;
  } else if (host === ZOHO_MAIL_SMTP_HOST) {
    port = 465;
    secure = true;
  } else {
    port = 587;
    secure = false;
  }

  const from = (process.env.EMAIL_FROM ?? "").trim() || DEFAULT_EMAIL_FROM;

  return { host, port, secure, user, password, from };
}

export function isZohoSmtpConfigured(): boolean {
  return resolveZohoSmtpConfig() !== null;
}

/** Same mailbox user/password as SMTP — IMAP reuses this, never a second password store. */
export function resolveZohoMailAuth(): ZohoMailAuth | null {
  const cfg = resolveZohoSmtpConfig();
  if (!cfg) return null;
  return { user: cfg.user, password: cfg.password };
}

function normalizeAddressList(
  value: string | string[] | undefined
): string[] | undefined {
  if (value == null) return undefined;
  const list = (Array.isArray(value) ? value : [value])
    .map((v) => v.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export async function sendViaZohoSmtp(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  inReplyTo?: string;
  references?: string;
  attachments?: ZohoSmtpAttachment[];
  headers?: Record<string, string>;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const cfg = resolveZohoSmtpConfig();
  if (!cfg) {
    return { ok: false, error: "Zoho SMTP not configured" };
  }

  const to = normalizeAddressList(opts.to);
  if (!to?.length) {
    return { ok: false, error: "Recipient (To) is required" };
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.password,
    },
  });

  try {
    const info = await transport.sendMail({
      from: (opts.from ?? "").trim() || cfg.from,
      to,
      cc: normalizeAddressList(opts.cc),
      bcc: normalizeAddressList(opts.bcc),
      subject: opts.subject,
      html: opts.html,
      text: opts.text?.trim() || undefined,
      inReplyTo: opts.inReplyTo?.trim() || undefined,
      references: opts.references?.trim() || undefined,
      headers: opts.headers,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        cid: a.cid,
      })),
    });
    const messageId = (info.messageId ?? "").trim();
    if (!messageId) {
      return { ok: false, error: "SMTP accepted without messageId" };
    }
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    return { ok: false, error: message };
  } finally {
    transport.close();
  }
}
