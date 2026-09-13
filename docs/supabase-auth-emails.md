# Supabase Auth emails (Nexo branded)

Branded transactional Auth emails for **Nexo Music Distribution LTD**.
These adapt the existing Account & Authentication lifecycle HTML — they are **not** redesigned and are **not** generic Supabase defaults.

## Mapping

| Supabase Auth type | Template file | Source lifecycle template |
|--------------------|---------------|---------------------------|
| Confirm signup / email verification | `supabase/templates/confirmation.html` | `002-verify-your-email-address` |
| Invite user | `supabase/templates/invite.html` | `001-welcome-to-nexo-music-distribution` |
| Magic link | `supabase/templates/magic_link.html` | `002` shell + magic-link copy |
| Reset password (recovery) | `supabase/templates/recovery.html` | `008-password-reset-request` |
| Change email address | `supabase/templates/email_change.html` | `010-email-address-change-requested` |
| Reauthentication / security | `supabase/templates/reauthentication.html` | `006-new-login-detected` (adapted) |

## Dynamic variables (GoTrue)

All action buttons use **`{{ .ConfirmationURL }}`** only. Do not hard-code tokens.

Also available when needed: `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}`.

## Environments

| Env | Site URL | Redirect URLs |
|-----|----------|---------------|
| Development | `http://localhost:3000` | `/auth/callback`, `/auth/confirm`, `/reset-password` |
| Production | `https://nexomusicdistribution.com` | same paths on production host |

Configure under **Authentication → URL Configuration** in the Supabase dashboard.

## Hosted Supabase (dashboard)

Local `config.toml` `content_path` applies to the Supabase CLI. For the hosted project:

1. Open **Authentication → Email → Templates**.
2. For each type above, paste the matching HTML from `supabase/templates/*.html`.
3. Set the subject lines from `supabase/config.toml` `[auth.email.template.*].subject`.
4. Save. Trigger a real Auth action to verify delivery (signup, reset, email change).

Do **not** claim an email was sent unless Supabase actually sends it (SMTP / built-in email).

## SMTP

Optional custom SMTP (e.g. Zoho) is configured in the dashboard. Prefer that for production deliverability. Never commit SMTP passwords or service-role keys.

## Security

- No service-role keys in this pack.
- No invented “live” store or royalty status emails here — Auth only.
- Keep PKCE / callback routes in the Next.js app unchanged unless a redirect fix is required.
