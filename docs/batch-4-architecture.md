# Batch 4 — Dashboard & Release Management Architecture

## Overview

Batch 4 adds a production artist/label portal for release creation, catalog, QC submission, notifications, and settings. Marketing pages and Batch 3 auth remain intact.

**Distribution delivery is not connected.** A provider-independent adapter ships with `NotConnectedProvider`, which returns clear “Not connected” errors. Approval ≠ delivered/live.

## Routes

Protected (artist/label; staff → `/admin`; public_user blocked; unverified → `/verify-email`; suspended blocked):

| Path | Purpose |
|------|---------|
| `/dashboard` | Overview with real DB counts + recent releases/notifications |
| `/dashboard/releases` | Catalog list (search/filter/sort/pagination) |
| `/dashboard/catalog` | Alias → releases list |
| `/dashboard/releases/new` | Multi-step create wizard |
| `/dashboard/releases/[id]` | Detail + history + actions; `?edit=1` for draft edit |
| `/dashboard/notifications` | In-app read/unread |
| `/dashboard/profile` | Existing profile schema |
| `/dashboard/settings` | Timezone/language + safe profile fields |

Legacy `/releases` and `/profile` redirect into `/dashboard/*`.

## Schema

Migration: `supabase/migrations/20260913000001_batch4_releases.sql`

### Tables

- **releases** — metadata, territories, distribution_settings, status, lock/submit timestamps, provider fields (`provider_*`, `provider_connected`)
- **release_tracks** — tracklist; optional user-supplied ISRC (never auto-fabricated)
- **release_contributors** — roles (primary/featured/producer/songwriter/…)
- **release_assets** — DB refs to Storage (`release-audio`, `release-artwork` private buckets)
- **release_status_history** — previous/new status, actor, timestamp, reason
- **release_submissions** — QC submission events + validation snapshot; prevents duplicate active submits via supersede
- **provider_release_links** — external provider ids/status (staff-writable)
- **notifications** — in-app inbox

FKs to `profiles`, `artist_profiles`, `label_profiles`. Indexes on owner, status, created_at, title search.

### Status lifecycle

```
draft → submitted → in_qc → approved | changes_requested | rejected
approved → scheduled → delivering → delivered → live
(approved|scheduled|delivered|live) → takedown_requested → taken_down
```

Owner-allowed transitions only: `draft|changes_requested → submitted`, and eligible takedown request.  
Staff (admin/support/super_admin) perform QC and ops transitions via `transition_release_status`.  
Users **cannot** self-approve or set `APPROVED` / `DELIVERED` / `LIVE` / provider fields.

Provider-gated statuses (`delivering`, `delivered`, `live`) require `provider_connected = true` (enforced in DB + app).

### RLS

All new tables enable RLS. Policies use `owns_release()`, `release_is_editable()`, `has_role()`, `is_staff()`, and `auth.uid()`.

Triggers:

- `protect_release_privileged_fields` — blocks non-staff status/provider/lock mutation on direct UPDATE
- `enforce_release_child_editability` — locks tracks/contributors/assets when parent not editable
- History/submissions: no direct client insert (SECURITY DEFINER RPCs only)

### Storage

| Bucket | Public | Path convention |
|--------|--------|-----------------|
| `release-audio` | no | `{userId}/{releaseId}/audio-…` |
| `release-artwork` | no | `{userId}/{releaseId}/artwork-…` |

RLS on `storage.objects` requires folder ownership. Asset rows store bucket+path (not ephemeral signed URLs alone). Replace-before-submit supported.

## Application layers

- **Server actions** (`dashboard/releases/actions.ts`) — all mutations; strip privileged fields; validate before submit
- **Queries** (`lib/releases/queries.ts`) — counts, list, detail
- **Status machine** (`lib/releases/status.ts`) — pure transition rules mirrored for tests
- **Validation** (`lib/releases/validation.ts`) — QC-ready checks
- **Provider** (`lib/provider`) — `getDistributionProvider()` → `NotConnectedProvider`
- **Realtime** — portal layout subscribes to `notifications` + `releases` (RLS filtered)

## Provider connection guide (future)

1. Implement `DistributionProvider` (submitRelease, updateRelease, requestTakedown, getReleaseStatus, getDeliveryStatus, getCatalog, syncRelease, handleWebhook).
2. Wire credentials via **server-only** env (never `NEXT_PUBLIC_`).
3. Replace `getDistributionProvider()` factory branch; set `releases.provider_connected = true` only after a successful provider handshake.
4. Staff/ops paths may then transition into `delivering` / `delivered` / `live`.
5. Webhooks update `provider_release_links` + status history; never trust client for provider fields.

Until then, UI shows **Not connected** and QC can still approve locally without implying DSP delivery.

## Intentional limitations

- No full admin QC UI (Batch 4 is artist/label + submission events only)
- No DSP delivery, royalties, or fake provider responses
- No auto-generated ISRC/UPC
- No new external email (in-app notifications only)
- Catalog route aliases the releases list
- Earnings/analytics remain empty shells from Batch 3
- Provider adapter is not-connected by design

## Testing

`npm test` covers authz/roles, ownership transition rules, validation, no self-approve, no fake provider delivery, storage path/mime concepts, notifications read model, adapter not-connected.

## Apply migration

```bash
# Via pooler (us-west-2), user postgres.{project_ref}
# Or paste SQL into Supabase SQL editor:
# supabase/migrations/20260913000001_batch4_releases.sql
```
