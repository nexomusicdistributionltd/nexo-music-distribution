import { escapeHtml } from "./sanitize";

const BODY_TOKEN = /\{\{\s*BODY\s*\}\}/g;
const PREHEADER_TOKEN = /\{\{\s*PREHEADER\s*\}\}/g;

/**
 * Compose a full email from the dark shell.
 * BODY is trusted admin/fragment HTML (not escaped). PREHEADER is escaped.
 */
export function composeFromShell(
  shellHtml: string,
  parts: { bodyHtml: string; preheader?: string; title?: string }
): string {
  let html = shellHtml.replace(BODY_TOKEN, parts.bodyHtml);
  html = html.replace(PREHEADER_TOKEN, escapeHtml(parts.preheader ?? ""));
  if (parts.title) {
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(parts.title)}</title>`
    );
  }
  return html;
}

export const DEFAULT_CUSTOM_BODY = `<p style="margin:0 0 14px 0;font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.22em;text-transform:uppercase;color:#8a8a8a;">Notice</p>
<h1 style="margin:0 0 24px 0;font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.03em;color:#ffffff;">New message</h1>
<p style="margin:0 0 18px 0;font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#f4f4f4;">Hi {{FIRST_NAME}},</p>
<p style="margin:0 0 18px 0;font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#c8c8c8;">Write your message here. This template uses the Nexo dark shell — keep the black field, silver type, and existing footer.</p>`;

/** Heuristic: newsletter/marketing HTML must not ship album/cover imagery. */
export function htmlContainsAlbumArtwork(html: string): boolean {
  return /<(img|image)\b[^>]*(?:cover[-_ ]?art|album[-_ ]?art|artwork)[^>]*>/i.test(
    html
  );
}
