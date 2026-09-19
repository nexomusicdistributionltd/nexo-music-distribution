# TooLost contract alignment — 19 September 2026

Source: user-supplied `toolostdocs.txt` (7,666 lines). Baseline: `cc1984cd5eb93d63c183a9e8025f2e13e682f988`.

## Implemented corrections

| Area | Documented contract | Nexo change |
| --- | --- | --- |
| Track writers | `/releases/{releaseId}/tracks` and `/submit`: Composer is `instrumentalist`; lyrics are `lyricist`; every track requires a Composer writer | Map Nexo composer/songwriter and lyricist correctly; reject missing/unsupported writer roles before outbound requests |
| Artist/label credits | Every track requires a writer | Credits screen checks every track, including release-wide credits; submission no longer exempts spoken-word genres without a documented exception |
| Release metadata | Title and rights lines have 120-character limits; copyright year is 1900–2100; dates use YYYY-MM-DD | Block overlong fields, out-of-range years and impossible dates before QC submission |
| Audio upload | Obtain upload URL, PUT FLAC bytes to storage with `audio/flac`, attach returned fileKey | Preserve this workflow; reject conflicting MIME types even if renamed to .flac; accept browser generic MIME and FLAC aliases |
| Draft updates | Metadata and track replacement apply to drafts | Check current upstream status before resuming a linked draft or updating metadata; never overwrite submitted releases |
| Validation errors | HTTP 422 provides field errors | Preserve the failure instead of silently stripping a selected TikTok preview offset and retrying |
| Analytics | Overview/charts/track require period; tracks also require page/perPage; platform data requires platform | Add typed periods with lastThirtyDays default, bounded pagination, and mandatory platform argument |
| Account isolation | OAuth account can hold multiple Nexo clients' catalogues | Preserve release/ISRC ownership filtering; remove unscoped overview and invalid unfiltered platform requests from artist/label loader |

## Workflow

Artist/label drafts → local validation → Nexo QC → approve or return with reason → corrected draft/resubmission → TooLost draft/upload/metadata/tracks → submit for review → status sync.

Nexo approval is not proof of DSP acceptance. Once TooLost has accepted submission, its draft-only endpoints cannot be used to reopen the remote release. The adapter stops and asks operations to sync/contact distribution support rather than creating a duplicate.

## Existing features checked, not changed

- Admin release detail renders QC or post-approval correction controls near the top, subject to the existing staff permissions.
- Local return-for-correction and owner email routing already exist; this change does not replace their migrations.
- Sales uses `page`/`per_page`, while releases use `page`/`perPage`.
- Provider-wide totals remain unavailable to artist/label views unless ownership is established.

## Limits of the supplied documentation

The export contains collapsed nested schemas (for example, “Show additional properties” and object summaries). It is not a complete machine-readable OpenAPI specification. Do not guess missing video writer/participant/delivery fields, AI documentation rules, or hidden enum values.

No documented marketing, SplitShare/payee, takedown/reinstatement or webhook-signature routes appear in this export. Those Nexo features must remain internal operations or explicitly unsupported upstream until an applicable contract is available. Do not invent endpoints or claim these are automated TooLost services.

The submission schema labels acceptTerms/confirmRights as strings while its request example uses booleans; the existing example-compatible booleans are retained pending sandbox confirmation.

The docs describe a metered API and a Free-plan hard cap. Fixing required parameters avoids wasted failed requests, but this change does not claim unlimited real-time polling or remove upstream reporting delays.

## Verification

- Production build: `npm run build` passed locally.
- TypeScript: `npx tsc --noEmit` passed after correcting pre-existing test-fixture type errors.
- Focused request tests exercise actual adapter fetch calls with mocked credentials/storage, FLAC PUT headers, writer payloads, draft protection, analytics filters and 422 errors.
- 509 tests across 91 test files passed with the two DDEX suites excluded. Those suites require `xmllint`, which is not installed in this environment; seven baseline failures were caused by that missing executable. No XSD check was marked as passed or disabled in the repository.
- Existing stale test fixtures were updated for current rights consent, payee IDs/email, per-track errors and FLAC-only validation. No production checks were disabled to satisfy tests.
- Production OAuth, database permissions/migrations, owner email delivery and DSP acceptance have not been exercised in this session. No live release was submitted.

## Deployment

Save one reviewable change set with `[skip netlify]` on the commit and PR title to avoid preview/branch builds. Keep production unchanged until the final consolidated deployment is chosen. Netlify documents these markers at https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy.
