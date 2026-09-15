# Featured Website Update + Move In Catalog

## Overview

Enhancement-only release on top of Batches 1–8:

1. **Featured website** — favicon/manifest/OG wiring, premium imagery, public catalog (`/music`), artist bios (`/artists/[slug]`), blog, CMS legal pages, partners marquee, TipTap + sanitized HTML, admin website controls.
2. **Move In Catalog** — extends Batch 6 `catalog_migrations` (no second release DB). Artist workflow: Search → Select → Review → MOVE IN with real job status fields.

## Public eligibility

A release appears on `/music` only when `website_published = true` (admin control).  
UI never invents **LIVE** — `publicStatusLabel` only returns labels for truthful `live` / `delivered` statuses.

Playback:

- Prefer official Spotify / Apple Music / YouTube embeds when URLs are set.
- Optional signed-URL audio only when `website_published` **and** `website_playback_enabled`.

## Move In without inventing external catalog

- Spotify/Apple discovery uses `discoverExternalCatalog` — returns **NOT CONNECTED / empty** unless real credentials exist.
- Artists import via **JSON / CSV / manual** metadata (`import_method`: `artist_json` | `artist_csv` | `manual`).
- Duplicate protection on ISRC/UPC; metadata gaps are flagged, never invented.
- `previous_distributor` required on create; `last_job_status` / `last_job_message` / `last_job_at` are real RPC outcomes (not fake progress bars).

## Migrations

- `20260915100000_featured_website_audit_enum.sql`
- `20260915100001_featured_website_cms.sql`

Apply via us-west-2 pooler with `SUPABASE_DB_PASSWORD` (additive only).

## Admin routes

- `/admin/website` — release/artist publish controls
- `/admin/partners` — marquee partners
- `/admin/blog` — TipTap posts
- `/admin/pages` — Privacy/Terms/Cookies + custom
- `/admin/distribution/migration` — staff migration hub (Batch 6)

## Artist routes

- `/dashboard/catalog/move-in` — Move In Catalog workflow + history

## Footer / SEO

Legal links point to `/privacy`, `/terms`, `/cookies` (CMS-backed). Sitemap includes music + blog. Manifest at `/manifest.webmanifest`.
