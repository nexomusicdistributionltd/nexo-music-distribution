# Nexo email architecture

## Layers

1. **Auth (A)** — Supabase Go templates in `supabase/templates/` + `config.toml`. See `docs/supabase-auth-emails.md`.
2. **Operational (B)** — Branded HTML in `emails/templates/` with `{{PLACEHOLDER}}` vars (Go-less). Catalog: `src/lib/email/catalog.ts`.
3. **Admin store (C)** — `public.email_templates` (ops | newsletter | custom). Staff edit subject + HTML; missing keys seed from repo files without overwriting edits.
4. **Outbox** — `public.email_events` with idempotent `enqueue_email_event` / `mark_email_event_status`.
5. **Provider** — `EMAIL_PROVIDER=none|resend` (+ optional SMTP stub). Never fake `sent`.

## Status truthfulness

| Status | Meaning |
|--------|---------|
| pending | Enqueued, not yet processed |
| processing | Send attempt in flight |
| sent | Provider accepted (`provider_message_id` required) |
| failed | Provider/render rejected |
| unavailable | No provider configured / transport not wired |

`RELEASE_LIVE` and `RELEASE_DELIVERED` templates are included but marked dormant — only enqueue/send on real status transitions / provider callbacks.

Manual / newsletter sends from Admin still go through the outbox. If `EMAIL_PROVIDER` is unset, events stay **pending** or **unavailable**. SENT is never shown unless the real adapter accepts the message.

## Admin UI

- `/admin/emails` — outbox
- `/admin/emails/templates` — browse / seed / edit (subject + HTML + preview)
- `/admin/emails/templates/new` — create a custom template by cloning `emails/shells/nexo-dark.html`
- `/admin/emails/send` — pick a stored template, select users (or all profiles), confirm, enqueue

Recipient emails for account/release lifecycle still resolve from owner/profile rows. Newsletter/manual sends also resolve from `profiles` (never from a browser-typed address).

## Newsletter

Repo files:

- `emails/templates/NEWSLETTER.html`
- `emails/templates/NEW_MUSIC_FRIDAY.html`
- `emails/shells/nexo-dark.html`
- `emails/brand.json` (HTTPS wordmark + `icon_light`)

Visual language: `#050505` / `#0a0a0a`, white/silver type, names + links only (no album artwork), LTD name/tagline/social footer.

## Apply migrations

1. `supabase/migrations/20260913180000_email_events_outbox.sql`  
   Copy: `docs/APPLY_email_events_migration.sql`  
2. `supabase/migrations/20260915090000_email_templates_audit_enum.sql`  
3. `supabase/migrations/20260915090100_email_templates.sql`  
4. `supabase/migrations/20260915090200_email_templates_audit_allowlist.sql`  
   Copy of 2–4: `docs/APPLY_email_templates_migration.sql`

If the database already has later-batch `audit_action` values (distribution, catalog, royalties, website), merge `email_retry` / `email_template_write` / `email_manual_send` into the existing `write_audit_log` staff list instead of replacing it wholesale.

Project: `axiwscoiwaurpvduwrgi`
