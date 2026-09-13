# Batch 5 — Admin & Operations Center

## Overview

Production staff portal under `/admin` for QC, catalog ops, artists/labels/users, finance architecture, compliance, support, contact inbox, notifications, audit, reports, and settings.

**No fabricated stats, earnings, streams, DSP deliveries, payouts, or provider responses.** Empty states when data is absent. Distribution provider remains `NotConnectedProvider`.

## RBAC

| Role | `/admin/*` | Notes |
|------|------------|-------|
| `support` | yes | Ops + QC + tickets; no settings / role changes |
| `admin` | yes | Full ops + settings |
| `super_admin` | yes | + privileged role changes via `super_admin_set_roles` |

Helpers: `src/lib/admin/permissions.ts` (`hasAdminPermission`, granular `AdminPermission`). Guards: `RequireAdmin`, `RequireAdminPermission`, `RequireSuperAdmin`. Middleware allows support on `/admin`.

## Routes

`/admin`, `/admin/releases`, `/admin/releases/[releaseId]`, `/admin/qc`, `/admin/artists`, `/admin/artists/[artistId]`, `/admin/labels`, `/admin/labels/[labelId]`, `/admin/users`, `/admin/finance`, `/admin/royalties`, `/admin/payouts`, `/admin/analytics`, `/admin/distribution`, `/admin/compliance`, `/admin/support`, `/admin/contact`, `/admin/notifications`, `/admin/audit`, `/admin/reports`, `/admin/settings`, `/admin/search`.

Global search UI in page headers → `/admin/search`.

## QC

- Work queue: `qc_queue_items` with priority, assignment, claim/release RPCs (`FOR UPDATE` race protection), safe bulk claim (≤25).
- Review: full metadata/tracks/artwork; audio via short-lived signed URLs.
- Checklist + `perform_qc_decision` → existing `transition_release_status` machine.
- Artist-visible reason vs internal note; `qc_reviews` stores reviewer + timestamp.

## Artists / Labels / Users

Directories + detail pages with related releases/tickets/timeline. Suspend/deactivate/restore via `admin_set_account_status` (reason + audit + notification). Timeline uses `activity_events` (staff/subject visibility — no private notes to artists).

## Finance / Royalties / Payouts

Schema: `ledger_accounts`, `ledger_entries` (immutable), `royalty_statements`, `royalty_line_items`, `payouts`, `payout_adjustments`. Integer **minor units** + ISO currency. UI shows “No financial data available yet” when empty. Payout PAID blocked without `payment_reference` + `paid_at` (DB trigger + app `canTransitionPayout`).

## Analytics / Distribution

Operational DB counts only. Provider analytics scaffold empty. Distribution monitor lists internal statuses + NotConnected banner — no fake DSP rows.

## Compliance / Support / Contact

- Compliance cases + private `compliance-evidence` bucket.
- Support tickets/messages/attachments (+ staff internal notes).
- Contact inbox + `POST /api/contact` → `submit_contact_message` (public form wired).

## Notifications / Audit / Reports / Settings / Email events

Extends Batch 4 notifications + Batch 3 audit. Report export requests audited. Settings allowlist with secret-pattern rejection. `email_outbound_events` architecture without pretending send.

## Migrations

- `20260913100000_batch5_audit_enum.sql`
- `20260913100001_batch5_admin_operations.sql`
- `20260913110000_batch5_hardening.sql`
- `20260913120000_batch5_hostile_audit.sql`

Additive; RLS + SECURITY DEFINER (`search_path = public`).

## Tests

Vitest: admin roles/routes, QC validation/transitions, finance/payout protection, search, notifications/audit/tickets permissions.

## Intentional limitations

- No distribution provider connection; cannot mark DELIVERED/LIVE without provider.
- No forged PAID payouts or sent emails.
- Report exports queue as `pending` (no fake file generation).

## Hostile audit

Closed private QC-note leakage; made queue assignment/priority race-safe RPC-only; made payout workflow RPC-only with no client money inserts; restricted ticket workflow changes to staff; allowlisted settings in app + DB; added contact throttling and attachment path checks.
