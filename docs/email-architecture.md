# Nexo email architecture

## Layers

1. **Auth (A)** — Supabase Go templates in `supabase/templates/` + `config.toml`. See `docs/supabase-auth-emails.md`.
2. **Operational (B)** — Branded HTML in `emails/templates/` with `{{PLACEHOLDER}}` vars (Go-less). Catalog: `src/lib/email/catalog.ts`.
3. **Outbox** — `public.email_events` with idempotent `enqueue_email_event` / `mark_email_event_status`.
4. **Provider** — `EMAIL_PROVIDER=none|resend` (+ optional SMTP stub). Never fake `sent`.

## Status truthfulness

| Status | Meaning |
|--------|---------|
| pending | Enqueued, not yet processed |
| processing | Send attempt in flight |
| sent | Provider accepted (`provider_message_id` required) |
| failed | Provider/render rejected |
| unavailable | No provider configured / transport not wired |

`RELEASE_LIVE` and `RELEASE_DELIVERED` templates are included but marked dormant — only enqueue/send on real status transitions / provider callbacks.

## Apply migration

File: `supabase/migrations/20260913180000_email_events_outbox.sql`  
Copy for MCP: `/workspace/nexo-email-architecture/APPLY.sql`  
Project: `axiwscoiwaurpvduwrgi`

Parent agent should apply via Supabase MCP `apply_migration` (executor cannot call MCP).
