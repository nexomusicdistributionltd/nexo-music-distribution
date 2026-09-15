# Production launch guide — NEXO Music Distribution (Batch 8)

Canonical site: **https://nexomusicdistribution.com**

## Environment

1. Copy `.env.example` → `.env.local` (or host secrets). Never commit `.env*.local`.
2. Required for auth/app:
   - `NEXT_PUBLIC_SITE_URL=https://nexomusicdistribution.com`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Server-only (never `NEXT_PUBLIC_*`):
   - `SUPABASE_SERVICE_ROLE_KEY` (webhooks / privileged jobs)
   - `PROVIDER_*`, `PAYMENT_*`, `ROYALTY_*`, `FX_*`, email/SMTP, webhook/cron secrets
4. Unset integrations must surface as **NOT CONNECTED / UNAVAILABLE** — never invent LIVE DSP, PAID payouts, or SENT email.

## Supabase Auth URL configuration (manual)

This deploy cannot change the Supabase dashboard. In **Authentication → URL Configuration**:

- **Site URL:** `https://nexomusicdistribution.com`
- **Redirect URLs:** include
  - `https://nexomusicdistribution.com/**`
  - `https://nexomusicdistribution.com/auth/callback`
  - `https://nexomusicdistribution.com/auth/callback?next=/reset-password`
  - `https://nexomusicdistribution.com/auth/confirm`
  - `https://nexomusicdistribution.com/reset-password`
- Recovery (PKCE): `resetPasswordForEmail` `redirectTo` = `https://nexomusicdistribution.com/auth/callback?next=/reset-password`
- Recovery (OTP template, optional): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- Auth emails (signup confirm, resend verify, forgot/reset password) use this domain — never `localhost` or `nexomusicdistro.space`.

## DDEX identity

- Server-only `NEXO_DPID` (production value `PA-DPIDA-2026021501-H`). Never `NEXT_PUBLIC_*`.
- **No authorized DSP recipient DPID.** Do not invent Spotify/Apple Party Ids. Leave `NEXO_DDEX_RECIPIENT_DPID` unset; production delivery stays disabled (NotConnected transport). Internal fixtures may use an isolated TEST recipient only.

## Database / migrations

- Apply SQL via us-west-2 pooler: `aws-0-us-west-2.pooler.supabase.com` (or `aws-1-…`), user `postgres.{project_ref}`, DB `postgres`.
- Password from ops secret store (`SUPABASE_DB_PASSWORD`) — never echo/commit.
- Batch 8 additive migration: `supabase/migrations/20260913400000_batch8_observability.sql`
  - Tables: `app_health_counters`, `app_job_runs`
  - RPCs: `bump_health_counter`, `record_job_run` (SECURITY DEFINER, `search_path` locked, staff/service authz)
- Never delete financial/history data.

## Deploy

1. Set production env vars on the host (Vercel/etc.).
2. `npm ci && npm test && npm run build && npm start` (or platform build).
3. Confirm security headers (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS).
4. Confirm `/api/health` and `/api/health/ready`.

## Webhooks

| Endpoint | Secret env | Behavior |
|----------|------------|----------|
| `POST /api/webhooks/provider` | `PROVIDER_WEBHOOK_SECRET` | Fail-closed if missing/invalid signature; idempotent by `(provider, event_id)` |
| `POST /api/webhooks/payout` | `PAYMENT_WEBHOOK_SECRET` | Same fail-closed + idempotent pattern |

Rate-limited per IP. Service role required to persist.

## Providers / integrations (truthful states)

| Integration | Connected when | Current default |
|-------------|----------------|-----------------|
| Distribution DSP | `PROVIDER_NAME` + `PROVIDER_API_KEY` (+ live adapter) | **NOT CONNECTED** until wired |
| Payments | Live payment adapter registered | **NOT CONNECTED** (env alone does not invent PAID) |
| Royalty reports | `ROYALTY_PROVIDER_*` + importer | **NOT CONNECTED** |
| FX | `FX_PROVIDER_*` + rates | **NOT CONNECTED** (no silent FX) |
| Email | SMTP/EMAIL_* configured + sender | **NOT CONNECTED** — enqueue pending/queued only; never mark SENT without provider |
| Publishing PRO/CMO | External PRO/CMO API | **NOT CONNECTED** |

## Email

- Batch 7 templates enqueue `pending`/`queued` only.
- Do not mark `sent` without a real provider acknowledgment.

## Payments / royalties / distribution

- Jobs and webhooks are idempotent / retry-safe.
- Observability: `app_job_runs` + `app_health_counters` (staff read).
- Unavailable integrations → `skipped_unavailable` / explicit errors — never fake success.

## Storage

- Private buckets: `release-audio`, `release-artwork`, `support-attachments`, `compliance-evidence`, `avatars`.
- Signed URLs: allowlisted buckets, TTL clamped 30–300s (default ~120).
- Upload mime/size validation enforced in app; path traversal rejected.

## Backup

- Use Supabase automated backups / PITR on the paid plan as available.
- Export critical finance tables periodically for offline retention.
- Never wipe ledger / payout / statement history.

## Health

- `GET /api/health` — liveness + truthful integration flags (`CONNECTED` vs `NOT CONNECTED`).
- `GET /api/health/ready` — DB reachable (anon). Returns 503 if Supabase env missing or DB unreachable.
- Unconfigured providers are **not** reported as healthy/connected.

## Rate limits (in-memory, fail-closed)

Contact, support, webhooks, release submit, uploads, payout create, royalty imports, admin payout process.

## SEO / domain

- Canonical + OG/Twitter via `NEXT_PUBLIC_SITE_URL` (default `https://nexomusicdistribution.com`).
- `robots.txt` disallows admin/auth/portal/api; sitemap is marketing-only.
- Admin/auth/portal layouts set `robots: noindex`.
- Localhost purged from production metadata defaults.

## Launch checklist

- [ ] Env vars set; no secrets in git
- [ ] Supabase Site URL + redirect URLs updated
- [ ] Migrations applied through Batch 8; RLS/policies verified
- [ ] `npm test` + `npm run build` green
- [ ] `/api/health` and `/api/health/ready` OK
- [ ] Webhook endpoints reachable; secrets set before enabling providers
- [ ] Confirm integrations show NOT CONNECTED until truly wired
- [ ] Backup / PITR confirmed
- [ ] DNS + TLS for nexomusicdistribution.com
- [ ] PR #7 remains unmerged until intentionally reviewed; Batch 8 branch not auto-merged

## Known unavailable integrations

Distribution LIVE delivery, payment execution, royalty provider ingest, FX conversion, transactional email send, Publishing PRO/CMO registration — all **NOT CONNECTED** until real adapters + credentials are added.
