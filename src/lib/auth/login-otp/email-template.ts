import { OTP_EMAIL_SUBJECT, OTP_TTL_MINUTES } from "@/lib/auth/login-otp/constants";
import { getSiteUrl } from "@/lib/site-url";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function loginOtpEmailSubject(): string {
  return OTP_EMAIL_SUBJECT;
}

/**
 * Branded Nexo login OTP email.
 * `code` is interpolated into HTML only for the outbound message body —
 * callers must never log this HTML or the code.
 */
export function buildLoginOtpEmailHtml(code: string): string {
  const site = getSiteUrl();
  const safeCode = escapeHtml(code);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#a3a3a3;">NEXO Music Distribution</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#fafafa;">Your Nexo Login Verification Code</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#e5e5e5;">
            Use this code to finish signing in. It expires in ${OTP_TTL_MINUTES} minutes.
          </p>
          <p style="margin:0 0 24px;text-align:center;font-size:36px;letter-spacing:0.28em;font-weight:700;color:#fafafa;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
            ${safeCode}
          </p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#a3a3a3;">
            If you did not try to sign in, you can ignore this email. Your password was not changed.
          </p>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;"/>
          <p style="margin:0;font-size:12px;color:#737373;">
            NEXO MUSIC DISTRIBUTION LTD ·
            <a href="${site}" style="color:#a3a3a3;">nexomusicdistribution.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
