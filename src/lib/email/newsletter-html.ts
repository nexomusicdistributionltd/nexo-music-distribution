import { NEXO_EMAIL_BRAND, emailSocialIconsRowHtml } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/email/sanitize";

export function buildNewsletterHtml(opts: {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  siteUrl?: string;
}): string {
  const site = opts.siteUrl ?? NEXO_EMAIL_BRAND.website;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 16px;text-align:center;">
            <img src="${escapeHtml(NEXO_EMAIL_BRAND.iconLight)}" alt="${escapeHtml(NEXO_EMAIL_BRAND.company)}" width="48" height="48" style="display:inline-block;border:0;" />
          </p>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#a3a3a3;">NEXO Music Distribution</p>
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#fafafa;">${escapeHtml(opts.subject)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#e5e5e5;">${opts.bodyHtml}</div>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;"/>
          <p style="margin:0 0 16px;font-size:12px;color:#737373;">
            You’re receiving this because you subscribed at
            <a href="${escapeHtml(site)}" style="color:#a3a3a3;">nexomusicdistribution.com</a>.
            <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#a3a3a3;">Unsubscribe</a>
          </p>
          ${emailSocialIconsRowHtml()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function bodyToPreviewHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<p style=\"color:#737373\">(Body)</p>";
  if (trimmed.includes("<")) return trimmed;
  return `<p style="white-space:pre-wrap;margin:0;">${escapeHtml(trimmed)}</p>`;
}
