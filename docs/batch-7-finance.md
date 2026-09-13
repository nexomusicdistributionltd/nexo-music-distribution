# Batch 7 — Royalties, Publishing & Finance

Extends Batch 5 finance stubs (`ledger_*`, `royalty_*`, `payouts`, `money.ts`). Integer **minor units** + ISO currency. Append-only ledger; corrections via compensating adjustments.

## Status machine (payouts)

`PENDING → UNDER_REVIEW → APPROVED → PROCESSING → PAID | REJECTED | FAILED` (also keeps `cancelled` / `on_hold`). **PAID** requires `payment_reference` + `paid_at` via `complete_payout_paid` with GUC `nexo.trusted_financial_transition` — never client-markable.

## Email events (enqueue pending only)

`payout_requested`, `payout_paid`, `payout_failed`, `payout_rejected`, `royalty_statement_published`, `publishing_work_update`, `compliance_payout_hold`.

## Unavailable by design

- Payment provider → `NotConnectedPaymentProvider`
- Royalty report provider → no invented imports
- FX rates → no silent conversion
- Publishing PRO registration / collections → no fake claims

## Migrations

- `20260913300000_batch7_audit_enum.sql`
- `20260913300001_batch7_royalties_publishing_finance.sql`
- `20260913300002_batch7_hardening.sql`
- `20260913300003_batch7_hostile_audit.sql`
