/** Attachment trust for inbound IMAP and outbound compose. Never execute untrusted types. */

export const EMAIL_ATTACHMENTS_BUCKET = "email-inbox-attachments";
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS = 8;

const SAFE_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
]);

const UNSAFE_EXT = /\.(exe|bat|cmd|com|msi|scr|js|jse|vbs|vbe|ps1|sh|dll|jar|apk|htm|html)$/i;

export function isTrustedAttachment(opts: {
  filename: string;
  contentType?: string | null;
}): boolean {
  const name = opts.filename.trim();
  if (!name || UNSAFE_EXT.test(name)) return false;
  const mime = (opts.contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (!mime) {
    // Unknown type: keep metadata only
    return false;
  }
  return SAFE_MIME.has(mime);
}

export function assertOutboundAttachment(opts: {
  filename: string;
  contentType?: string | null;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!opts.filename.trim()) return { ok: false, error: "Attachment filename required." };
  if (opts.size <= 0) return { ok: false, error: "Empty attachment." };
  if (opts.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Attachment exceeds 8MB limit." };
  }
  if (!isTrustedAttachment(opts)) {
    return { ok: false, error: `Untrusted attachment type: ${opts.filename}` };
  }
  return { ok: true };
}
