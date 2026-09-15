# Stardust Distro + DDEX production integration

**Final status: Stardust Distro is an internal DDEX/ERN generation and delivery layer only. Stardust ≠ commercial DSP access. It does not create commercial DSP relationships.**

Branch: `cursor/stardust-ddex-layer-86ea` (from `main` @ `504be8f`). Do not merge until review.

---

## 1. Pre-install audit

Inspected Nexo `main` (including merged PR #30) and [Stardust Distro](https://github.com/daddykev/stardust-distro) (`@stardust-distro/cli`).

| Area | Finding |
|------|---------|
| Stack | Next.js 15 App Router, Supabase Auth/Postgres/Storage, Netlify-oriented deploy. **Not** Firebase. |
| Catalog | `releases`, `release_tracks`, `release_contributors`, `release_assets`, `release_deals` (Batch 4 + DDEX foundation). |
| Existing ERN | Production ERN **4.3.2** already exists: `src/lib/ddex/{builder,mapping,validate,xsd}` with official XSD, AvsVersionId=9, compact DPID `PADPIDA…`. **Reused, not duplicated.** |
| Ledger | `ddex_messages` + private `ddex-ern` bucket. Delivery was a **NotConnected stub**. |
| Distribution | Batch 6 `distribution_jobs` / provider adapters remain provider-agnostic. Catalog `release_status` is **not** flipped by this DDEX layer. |
| Identity | Locked sender **NEXO MUSIC DISTRIBUTION LTD** / **PA-DPIDA-2026021501-H**. Env: `NEXO_DPID` already documented; `NEXO_DDEX_DPID` / `NEXO_DDEX_PARTY_NAME` added. |
| `NEXO_DDEX_CONTACT` | **Not present** in repo or `.env.example` as a real value. Left empty. **Not invented.** |
| Stardust | Vue + **Firebase** app shell, ERN 3.8.2/4.2/4.3 builders (fabricate `Untitled` / `Unknown Artist`), delivery protocols FTP/SFTP/S3/REST/Azure, queue/retry/idempotency, hardcoded third-party test FTP passwords. |

Did **not** run `npx @stardust-distro/cli create` inside Nexo (would scaffold/overwrite). Did **not** add Firebase.

---

## 2. Architecture choice (A > B > C)

**Option A selected:** reuse Nexo ERN 4.3.2 + extract Stardust delivery/package/queue patterns into `src/lib/ddex/` (TypeScript, Supabase).

- Option B (extract a separate service) was unnecessary — Nexo already owns mapping + XSD.
- Option C (private microservice) was not required for this enhancement.

Stardust XML builders are **not** the primary generator: they invent metadata. Nexo’s mapper fails closed on missing ISRC/UPC/artwork/deals.

---

## 3. What was reused vs extracted vs unused

**Reused (Nexo):** ERN 4.3.2 builder, official XSD, readiness, `ddex_messages`, Admin `/admin/ddex`, compact DPID, fixtures.

**Extracted (Stardust concepts, no Firebase):** protocol adapters, SHA-256/MD5 package hashing, 1m/5m/15m retry backoff, idempotency keys, Initial/Update/Takedown subtypes, per-target ERN 4.2 / 3.8.2 XML **from the Nexo-mapped model** (no Untitled fallbacks). MIT notice: `src/lib/ddex/NOTICE-STARDUST.md`.

**Unused:** Firebase, Vue UI, CLI create scaffold, Stardust test DSP passwords (dlptest/Rebex), fake Spotify/Apple targets.

---

## 4. Sender identity and production guard

| Field | Value |
|-------|--------|
| Party Name | NEXO MUSIC DISTRIBUTION LTD (`NEXO_DDEX_PARTY_NAME`) |
| DPID | PA-DPIDA-2026021501-H (`NEXO_DDEX_DPID`, alias `NEXO_DPID`) |
| Contact | `NEXO_DDEX_CONTACT` **missing — not invented** |

`assertLockedSenderForDelivery()` **blocks all delivery** if compact sender DPID ≠ `PADPIDA2026021501H`.

Public Admin status never includes DPID strings (`ddexConfigPublicStatus`). No `NEXT_PUBLIC_*DPID`.

---

## 5. Domain layer and APIs

Server-only in `src/lib/ddex/`:

| API | Role |
|-----|------|
| `validateReleaseForDdex` | Identity + catalog + rights readiness; stores `ddex_validation_runs` |
| `generateDdexRelease` | Initial NewReleaseMessage |
| `buildDdexPackage` / `generateDdexPackage` | Immutable snapshot + hashes → `READY_FOR_DELIVERY` |
| `queueDdexDelivery` | Idempotent queue |
| `sendDdexDelivery` | Protocol send (local test only today) |
| `generateDdexUpdate` / `generateDdexTakedown` | Lifecycle messages |
| `processDdexAcknowledgment` | Modular ACK |

Primary XML: ERN **4.3.2**. Target `ern_version` `4.3` maps to 4.3.2. `4.2` / `3.8.2` are per-target compat only (not 4.3.2 XSD-certified).

---

## 6. Validation and mapping

Existing mapper still fails on missing ISRC, UPC, artwork, audio, C/P lines, territories, UseType, CommercialModelType. Nothing is fabricated.

Validation reports are stored for Admin. Artist/Label see status only.

---

## 7. Packages and lifecycle

Packages live in private bucket `ddex-packages`. XML remains in `ddex-ern`.

- **Initial** — NewReleaseMessage
- **Update** — new MessageId, same MessageThreadId
- **Takedown** — ValidityPeriod `EndDate` (ERN 4.3.2-safe; not PurgeReleaseMessage)

Catalog `release_status` is unchanged by test delivery.

---

## 8. Delivery targets / DSP connection table

Seeded production target: **Nexo Local Test Target** (`nexo-local-test`, protocol `local`, ERN 4.3.2). Loopback recipient = Nexo sender DPID. Writes to private storage. **Not a commercial DSP.**

Protocols implemented in code: local, FTP, SFTP, S3, REST, Azure. **Only local test is active.** Others are NOT CONNECTED until real credentials + receiver DPID + commercial approval exist. SDKs are optional; missing packages do not activate a target.

| DSP | Receiver DPID | Credentials | Commercial approval | Status |
|-----|---------------|-------------|---------------------|--------|
| Spotify | Missing | Missing | Required | NOT CONNECTED |
| Apple Music | Missing | Missing | Required | NOT CONNECTED |
| Amazon Music | Missing | Missing | Required | NOT CONNECTED |
| YouTube Music | Missing | Missing | Required | NOT CONNECTED |
| TikTok | Missing | Missing | Required | NOT CONNECTED |
| Deezer | Missing | Missing | Required | NOT CONNECTED |
| Nexo Local Test Target | Nexo loopback (test) | Local storage | Not required | Test connected only |

**Stardust does not create these commercial relationships.**

---

## 9. Admin and Artist/Label UI

Admin `/admin/ddex` extended (no second dashboard): validate, generate, preview XML, package, queue, test deliver, retry, ack, update, takedown, target list. Credentials never rendered.

Artist/Label release page: **Delivery status** tab only (no raw DSP control, no endpoints, no secrets).

---

## 10. Tests, migrations, remaining work

Additive migrations:

- `20260915910000_stardust_ddex_audit_enum.sql`
- `20260915910001_stardust_ddex_delivery.sql`
- `20260915910002_stardust_ddex_audit_allowlist.sql`

Apply on the host before expecting `dsp_targets` / owner RPC.

Verified locally on this branch (from `main` @ `504be8f`):

- `npm test` — 72 files, 430 tests, all passed (includes existing ERN 4.3.2 XSD tests + `stardust-layer.test.ts`)
- `npm run build` — Next.js 15.5.25 production build green (compile, lint, typecheck)

Remaining (intentionally not faked):

- Real DSP contracts, receiver DPIDs, and credentials
- Installing FTP/SFTP/S3/Azure SDKs only when a real target is approved
- Official ERN 4.2 / 3.8.2 XSD bundles (compat XML is structural)
- `NEXO_DDEX_CONTACT` is still missing — left empty, not invented

---

## 11. Final status

**Final status: Stardust Distro is an internal DDEX/ERN generation and delivery layer only. Stardust ≠ commercial DSP access. It does not create commercial DSP relationships.**
