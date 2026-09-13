# Batch 6 — Distribution Core & Catalog Migration

## Architecture

Provider-independent distribution layer:

| Layer | Location | Role |
|-------|----------|------|
| Adapter interface | `src/lib/provider/types.ts` | `submitRelease`, `updateRelease`, `requestTakedown`, `reinstateRelease`, `getReleaseStatus`, `getDeliveryStatus`, `getCatalog`, `syncRelease`, `handleWebhook` |
| Factory | `src/lib/provider/index.ts` → `getProvider()` | `NotConnectedProvider` when unset; pluggable real adapter behind `PROVIDER_NAME` + server-only credentials |
| Config | `src/lib/provider/config.ts` (`server-only`) | Reads `PROVIDER_*` env; never exposes secrets |
| Engine | `src/lib/distribution/*` | Queue, submit (idempotent), sync, webhook verify, takedown/reinstate |
| Catalog migration | `src/lib/migration/*` | External discovery (unavailable without credentials), ISRC/UPC preservation, duplicate detection |
| Admin hub | `/admin/distribution/*` | Overview, Provider, Queue, Submissions, Delivery, Webhooks, Failed, Takedowns, Migration, History, Mapping, Search |
| Webhook | `POST /api/webhooks/provider` | Signature verify (fail closed if secret missing); idempotent by event id |

## Status model

Existing `release_status` enum extended with **`failed`**. UI labels:

| Status | Label |
|--------|-------|
| `in_qc` | QC Review |
| `scheduled` | Queued for distribution |
| `delivering` | Distributing |
| `delivered` / `live` / `failed` | Delivered / Live / Failed |

Queue state also lives in `distribution_jobs` (`queued` → `submitting` → `submitted` → …). Clients cannot mass-assign `status` / `provider_*` (Batch 4–5 protect triggers preserved).

## Tables (additive)

- `distribution_jobs`, `provider_submissions`, `provider_webhook_events`, `provider_sync_runs`, `distribution_retries`
- `catalog_migrations`, `catalog_migration_items`, `catalog_migration_conflicts`, `artist_dsp_mappings`

All RLS-enabled. Staff vs owner select policies. Writes via SECURITY DEFINER RPCs (`search_path = public`) with auth checks. Catalog migrations are **never hard-deleted** (trigger).

## RPCs / actions

- `queue_approved_release` — approved/failed → scheduled + job
- `begin_submit_queued_release` / `complete_submit_queued_release` — idempotent submit ledger
- `record_provider_sync_run` — polling for providers without webhooks
- `process_provider_webhook_event` — signature outcome + safe status map
- `request_distribution_takedown` / `reinstate_distribution_release`
- `create_catalog_migration`, `upsert_artist_dsp_mapping`, `offer_old_distributor_takedown` (only after delivery verified)

## Email events

On real transitions (`approved`, `scheduled`/`queued`, `delivering`, `delivered`, `live`, `failed`, `takedown_*`) we enqueue `email_outbound_events` with status **`queued`/`pending`**. Never `sent` without a real email provider (`protect_email_outbound_sent`).

## Genuinely unavailable without credentials

| Capability | Without credentials |
|------------|---------------------|
| Submit / update / sync / catalog / webhook handle | `ProviderNotConnectedError` / **Provider Not Connected** |
| LIVE / DELIVERED / DSP delivery rows | Impossible — gated on `provider_connected` + real provider events |
| Webhook acceptance | **Fail closed** if `PROVIDER_WEBHOOK_SECRET` missing |
| External catalog discovery (Spotify/Apple) | **Unavailable** — empty items, no invented releases |
| Old-distributor takedown | Not automatic; offered only after delivery verified |
| Email `sent` | Blocked without provider + message id |

## Env (server-only)

See `.env.example`: `PROVIDER_NAME`, `PROVIDER_API_KEY`, `PROVIDER_API_BASE_URL`, `PROVIDER_WEBHOOK_SECRET`, optional `SPOTIFY_*` / `APPLE_MUSIC_*`. Never commit secrets; `.env.local` stays gitignored.

## Migrations

- `20260913200000_batch6_audit_enum.sql`
- `20260913200001_batch6_distribution_core.sql`
- `20260913200002_batch6_catalog_migration.sql`
- `20260913200003_batch6_hardening.sql`
