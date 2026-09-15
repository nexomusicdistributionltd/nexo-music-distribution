import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import {
  resolveZohoMailAuth,
  ZOHO_MAIL_IMAP_HOST,
} from "@/lib/email/zoho-smtp";
import { threadKeyFromHeaders } from "@/lib/email/thread";
import { sanitizeInboundHtml, htmlToPlainText } from "@/lib/email/inbound-html";
import { isTrustedAttachment } from "@/lib/email/attachments";

export type ZohoImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

/**
 * Zoho Mail IMAP using the same mailbox credentials as SMTP.
 * Does not create an SMTP transporter. Does not invent inbox rows from outbound events.
 */
export function resolveZohoImapConfig(): ZohoImapConfig | null {
  const auth = resolveZohoMailAuth();
  if (!auth) return null;
  const host = (process.env.IMAP_HOST ?? "").trim() || ZOHO_MAIL_IMAP_HOST;
  const portRaw = (process.env.IMAP_PORT ?? "").trim();
  const port = portRaw ? Number(portRaw) : 993;
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 993,
    secure: true,
    user: auth.user,
    password: auth.password,
  };
}

export function isZohoImapConfigured(): boolean {
  return resolveZohoImapConfig() !== null;
}

function addrList(value: AddressObject | AddressObject[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of list) {
    for (const a of item.value ?? []) {
      const email = (a.address ?? "").trim().toLowerCase();
      if (email) out.push(email);
    }
  }
  return out;
}

function firstFrom(parsed: ParsedMail): { email: string; name: string | null } {
  const v = parsed.from?.value?.[0];
  return {
    email: (v?.address ?? "").trim().toLowerCase(),
    name: (v?.name ?? "").trim() || null,
  };
}

export type ParsedInboxMessage = {
  folder: string;
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  threadKey: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  date: string | null;
  seen: boolean;
  textBody: string;
  htmlBodySanitized: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    trusted: boolean;
    content: Buffer | null;
  }>;
};

export function parsedMailToInbox(
  parsed: ParsedMail,
  meta: { folder: string; uid: number; seen: boolean }
): ParsedInboxMessage {
  const from = firstFrom(parsed);
  const messageId = (parsed.messageId ?? "").trim() || null;
  const inReplyTo = (parsed.inReplyTo ?? "").trim() || null;
  const references = Array.isArray(parsed.references)
    ? parsed.references.join(" ")
    : (parsed.references ?? "").toString().trim() || null;
  const html = parsed.html ? String(parsed.html) : "";
  const text = parsed.text ? String(parsed.text) : htmlToPlainText(html);
  const attachments: ParsedInboxMessage["attachments"] = [];
  for (const att of parsed.attachments ?? []) {
    const filename = att.filename || "attachment";
    const contentType = att.contentType || "application/octet-stream";
    const trusted = isTrustedAttachment({ filename, contentType });
    attachments.push({
      filename,
      contentType,
      size: att.size || (att.content ? att.content.length : 0),
      trusted,
      content: trusted && att.content ? Buffer.from(att.content) : null,
    });
  }
  return {
    folder: meta.folder,
    uid: meta.uid,
    messageId,
    inReplyTo,
    references,
    threadKey: threadKeyFromHeaders({
      messageId,
      inReplyTo,
      references,
    }),
    fromEmail: from.email,
    fromName: from.name,
    toEmails: addrList(parsed.to),
    ccEmails: addrList(parsed.cc),
    bccEmails: addrList(parsed.bcc),
    subject: (parsed.subject ?? "").trim() || "(no subject)",
    date: parsed.date ? parsed.date.toISOString() : null,
    seen: meta.seen,
    textBody: text.slice(0, 200_000),
    htmlBodySanitized: sanitizeInboundHtml(html).slice(0, 400_000),
    attachments,
  };
}

export async function fetchRecentInboxMessages(opts?: {
  folder?: string;
  limit?: number;
}): Promise<
  | { ok: true; messages: ParsedInboxMessage[]; mailbox: string }
  | { ok: false; error: string }
> {
  const cfg = resolveZohoImapConfig();
  if (!cfg) {
    return { ok: false, error: "Zoho IMAP not configured" };
  }
  const folder = opts?.folder?.trim() || "INBOX";
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 100));

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const mailbox = client.mailbox;
      const exists =
        mailbox && typeof mailbox === "object" ? Number(mailbox.exists ?? 0) : 0;
      if (exists < 1) {
        return { ok: true, messages: [], mailbox: folder };
      }
      const fromSeq = Math.max(1, exists - limit + 1);
      const messages: ParsedInboxMessage[] = [];
      for await (const msg of client.fetch(
        `${fromSeq}:*`,
        { uid: true, flags: true, source: true, envelope: true },
        { uid: false }
      )) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const flags = msg.flags ?? new Set<string>();
        const seen = flags.has("\\Seen") || flags.has("Seen");
        messages.push(
          parsedMailToInbox(parsed, {
            folder,
            uid: Number(msg.uid),
            seen,
          })
        );
      }
      return { ok: true, messages, mailbox: folder };
    } finally {
      lock.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "IMAP fetch failed";
    return { ok: false, error: message };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}
