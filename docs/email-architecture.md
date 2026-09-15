# Nexo email architecture

## Layers

1. **Auth (A)** — Supabase Go templates in `supabase/templates/` + `config.toml`. See `docs/supabase-auth-emails.md`.
2. **Operational (B)** — Branded HTML in `emails/templates/` with `{{PLACEHOLDER}}` vars (Go-less). Catalog: `src/lib/email/catalog.ts`.
3. **Admin store (C)** — `public.email_templates` (ops | newsletter | custom). Staff edit subject + HTML; missing keys seed from repo files without overwriting edits. This is **not** an outbox.
4. **Outbox** — canonical `public.email_outbound_events` (`queued` | `skipped` | `failed` | `sent`) with `protect_email_outbound_sent`. App enqueue still calls `enqueue_email_event` / `mark_email_event_status`, which now write this table. Idempotency and recipient user id live in `payload` (`_idempotency_key`, `_recipient_user_id`, `_event_type`).
5. **Provider** — `EMAIL_PROVIDER=none|resend` (+ optional SMTP stub). Never fake `sent`.

## Outbox reconciliation (do not merge to main until this is settled)

PR #5 introduced a parallel table `public.email_events` (pending/processing/sent/failed/unavailable) plus RPCs that wrote to it. **That table is legacy.** This follow-up retargets enqueue/process/retry/admin send onto main’s Batch 5 outbox:

| | Legacy PR #5 | Canonical (this work) |
|---|---|---|
| Table | `email_events` | `email_outbound_events` |
| Status | pending / processing / unavailable / failed / sent | queued / skipped / failed / sent |
| SENT guard | `mark_email_event_status` requires `provider_message_id` | `protect_email_outbound_sent` + real provider (not none/not_connected/fake/test/null) + `provider_message_id` |
| Idempotency | unique `idempotency_key` column | unique index on `payload->>'_idempotency_key'` |

Do **not** introduce a third outbox. Do **not** grow `email_events`. `email_templates` stays as the admin HTML store only.

Status mapping: `pending`/`processing` → `queued`; `unavailable` → `skipped`. There is no `processing` value on the canonical enum — rows stay `queued` until skipped/failed/sent.

SQL triggers from `20260913180000_email_events_outbox.sql` still call `enqueue_email_event`; the function body now inserts into `email_outbound_events`. Existing `email_events` rows are not migrated in this change.

## Status truthfulness

| Status | Meaning |
|--------|---------|
| queued | Enqueued, not yet accepted by a provider |
| skipped | No provider configured / transport not wired (`EMAIL_PROVIDER=none`) |
| sent | Provider accepted (`provider` + `provider_message_id` required; trigger rejects fake providers) |
| failed | Provider/render rejected, or accept without a real message id |

`RELEASE_LIVE` and `RELEASE_DELIVERED` templates are included but marked dormant — only enqueue/send on real status transitions / provider callbacks.

Manual / newsletter sends from Admin still go through the canonical outbox. If `EMAIL_PROVIDER` is unset, events stay **queued** or **skipped**. SENT is never shown unless the real adapter accepts the message.

## Admin UI

- `/admin/emails` — outbox (`email_outbound_events`)
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

1. `supabase/migrations/20260913180000_email_events_outbox.sql` — legacy table + original RPCs (keep for history; RPCs are replaced below)  
   Copy: `docs/APPLY_email_events_migration.sql`  
2. `supabase/migrations/20260915090000_email_templates_audit_enum.sql`  
3. `supabase/migrations/20260915090100_email_templates.sql`  
4. `supabase/migrations/20260915090200_email_templates_audit_allowlist.sql`  
   Copy of 2–4: `docs/APPLY_email_templates_migration.sql`
5. `supabase/migrations/20260915100000_retarget_enqueue_to_email_outbound_events.sql`  
   Copy: `docs/APPLY_email_outbound_retarget.sql`

If the database already has later-batch `audit_action` values (distribution, catalog, royalties, website), merge `email_retry` / `email_template_write` / `email_manual_send` into the existing `write_audit_log` staff list instead of replacing it wholesale.

Project: `axiwscoiwaurpvduwrgi`
