import { composeFromShell } from "@/lib/email/compose";
import { NEXO_EMAIL_BRAND, emailSocialIconsRowHtml } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/email/sanitize";
import { PRIMARY_CONTACT_EMAIL } from "@/lib/brand/contact";

export function wrapWithEmailShell(
  shellHtml: string,
  opts: { subject: string; bodyHtml: string; preheader?: string }
): string {
  return composeFromShell(shellHtml, {
    bodyHtml: opts.bodyHtml,
    preheader: opts.preheader ?? opts.subject,
    title: opts.subject,
  });
}

/** Fallback branded wrapper when the dark shell file is unavailable (client preview). */
export function fallbackBrandedHtml(opts: {
  subject: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>${escapeHtml(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 16px;text-align:center;">
            <img src="${escapeHtml(NEXO_EMAIL_BRAND.iconLight)}" alt="Nexo" width="48" height="48" style="border:0;" />
          </p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#fafafa;">${escapeHtml(opts.subject)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#e5e5e5;">${opts.bodyHtml}</div>
          <p style="margin:24px 0 12px;font-size:12px;color:#737373;">
            ${escapeHtml(NEXO_EMAIL_BRAND.company)} ·
            <a href="mailto:${PRIMARY_CONTACT_EMAIL}" style="color:#a3a3a3;">${PRIMARY_CONTACT_EMAIL}</a>
          </p>
          ${emailSocialIconsRowHtml()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function brandedHtmlFromShellOrFallback(
  shellHtml: string | null | undefined,
  opts: { subject: string; bodyHtml: string; preheader?: string }
): string {
  if (shellHtml && shellHtml.includes("{{BODY}}")) {
    return wrapWithEmailShell(shellHtml, opts);
  }
  return fallbackBrandedHtml(opts);
}

export function contactReplyBodyHtml(opts: {
  visitorName: string;
  originalSubject: string;
  originalMessage: string;
  replyBody: string;
}): string {
  const reply = opts.replyBody.includes("<")
    ? opts.replyBody
    : `<p style="white-space:pre-wrap;margin:0 0 18px;">${escapeHtml(opts.replyBody)}</p>`;
  return `${reply}
<p style="margin:28px 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8a8a;">Your message</p>
<p style="margin:0 0 8px;font-size:13px;color:#c8c8c8;"><strong>${escapeHtml(opts.originalSubject)}</strong></p>
<blockquote style="margin:0;padding:12px 14px;border-left:2px solid #2a2a2a;color:#a3a3a3;white-space:pre-wrap;">${escapeHtml(opts.originalMessage)}</blockquote>
<p style="margin:18px 0 0;font-size:13px;color:#737373;">Hi ${escapeHtml(opts.visitorName || "there")} — this is a reply from ${escapeHtml(NEXO_EMAIL_BRAND.company)}.</p>`;
}
