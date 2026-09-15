# Premium Website Experience

Enhancement on top of Featured Website Update — no rebuild of Auth / Admin Center / catalog tables.

## Player audio source rules

1. Primary player is **Nexo-owned** (`NexoMusicPlayer` / HTML5 `<audio>`).
2. Audio streams only via short-lived signed URLs from the private `release-audio` bucket.
3. Eligibility: `website_published = true` **AND** `website_playback_enabled = true`.
4. Track gate: if `release_tracks.website_preview_enabled = false`, that track is skipped; `true` or unset allows it under the release gate.
5. Empty / unavailable UI when no authorized audio.
6. Spotify / Apple / YouTube URLs are **outbound buttons** (“Listen on Spotify”, etc.) — never primary iframes.
7. Videos (`website_videos`) may use YouTube embeds inside Nexo chrome and are labeled **External source**.

## Canonical routes

| Resource | Canonical | Legacy |
|----------|-----------|--------|
| Release | `/release/[slug]` | `/music/[slug]` redirects |
| Artist profile | `/artist/[slug]` | `/artists/[slug]` redirects |
| Music catalog | `/music` | — |
| For Artists (marketing) | `/artists` | — |

## Migrations

- `20260915200000_premium_website_experience.sql` — `website_settings`, `website_videos`, artist genres, realtime publication, public contributors select, extended artist website RPC.

## Admin

- `/admin/website` — homepage settings + publish/feature/playback + DSP outbound links
- `/admin/artists/[id]` — website bio editor
- `/admin/videos` — external video CRUD

## Intentional limitations

- No fake artists / releases / bios / stats / streams / trending.
- No downloading or re-hosting of third-party videos.
- Public realtime only for tables with public SELECT RLS on published rows.
- Artwork/audio signed URLs expire quickly (≤5 minutes).
