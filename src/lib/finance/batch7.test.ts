import { describe, it, expect, beforeEach } from "vitest";
import {
  assertMinorUnits,
  formatMinorUnits,
  canTransitionPayout,
  canSetPaidWithPaymentOp,
  allowedPayoutTransitions,
  toTransactionKind,
  convertMinorUnitsWithRate,
  validateShareBpsTotal,
  emptyBalancesMessage,
} from "./money";
import { validateSplitShares, allocateByBps, effectiveRuleApplies } from "./splits";
import { deriveBalancesFromEntries, isNegativeBalanceAllowed } from "./balances";
import { computeStatementTotals } from "./statements";
import { evaluatePayoutEligibility } from "./eligibility";
import { importIdempotencyKey, resolveMatchStatus, validateImportRowAmounts } from "./imports";
import { findFxRate, fxUnavailableMessage } from "./fx";
import { BATCH7_EMAIL_TEMPLATES, allowedEnqueueStatuses } from "./email-events";
import { isAllowedFinanceReportType } from "./exports";
import { canMarkPayoutPaid } from "@/lib/admin/permissions";
import { validatePublishingShares } from "@/lib/publishing/shares";
import {
  NO_FAKE_COLLECTION_MESSAGE,
  NO_FAKE_REGISTRATION_MESSAGE,
} from "@/lib/publishing/types";
import {
  extractProviderPayoutReference,
  extractPayoutMappedStatus,
  extractPayoutPaymentReference,
  extractPayoutWebhookEventId,
} from "./payment/webhook";

describe("Batch 7 ledger / money", () => {
  it("uses integer minor units only", () => {
    expect(assertMinorUnits(100)).toBe(true);
    expect(assertMinorUnits(1.5)).toBe(false);
    expect(formatMinorUnits(999, "USD")).toContain("9.99");
  });

  it("maps transaction kinds", () => {
    expect(toTransactionKind("royalty_credit")).toBe("ROYALTY");
    expect(toTransactionKind("deduction")).toBe("DEDUCTION");
    expect(toTransactionKind("payout")).toBe("PAYOUT");
    expect(toTransactionKind("refund")).toBe("REFUND");
  });

  it("does not invent empty balances as fake earnings", () => {
    expect(emptyBalancesMessage(false)).toMatch(/No financial data/);
  });
});

describe("Batch 7 import idempotency", () => {
  it("builds stable idempotency keys", () => {
    expect(
      importIdempotencyKey({ sourceProvider: "foo", reportId: "r1", rowKey: "10" })
    ).toBe("foo::r1::10");
  });

  it("resolves match / conflict statuses without inventing data", () => {
    expect(resolveMatchStatus({})).toBe("unmatched");
    expect(resolveMatchStatus({ releaseId: "x" })).toBe("matched");
    expect(resolveMatchStatus({ conflictReason: "dup" })).toBe("conflict");
  });

  it("validates import amounts as integers + ISO currency", () => {
    expect(validateImportRowAmounts({ amountMinor: 10, currency: "USD" }).ok).toBe(true);
    expect(validateImportRowAmounts({ amountMinor: 1.2, currency: "USD" }).ok).toBe(false);
    expect(validateImportRowAmounts({ amountMinor: 10, currency: null }).ok).toBe(false);
  });
});

describe("Batch 7 splits", () => {
  it("rejects shares over 100%", () => {
    expect(validateShareBpsTotal([6000, 5000]).ok).toBe(false);
    expect(
      validateSplitShares([
        { partyName: "A", partyRole: "artist", shareBps: 6000 },
        { partyName: "B", partyRole: "label", shareBps: 5000 },
      ]).ok
    ).toBe(false);
  });

  it("allocates integer minor units by bps", () => {
    const parts = allocateByBps(100, [{ shareBps: 3333 }, { shareBps: 3333 }, { shareBps: 3334 }]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("respects effective dates for historical reproducibility", () => {
    expect(
      effectiveRuleApplies({
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        asOf: "2026-03-01",
      })
    ).toBe(true);
    expect(
      effectiveRuleApplies({
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        asOf: "2026-07-01",
      })
    ).toBe(false);
  });
});

describe("Batch 7 balances / statements", () => {
  it("derives balances from ledger entries", () => {
    const bal = deriveBalancesFromEntries(
      [
        { amount_minor: 500, balance_bucket: "available", currency: "USD" },
        { amount_minor: 200, balance_bucket: "pending", currency: "USD" },
        { amount_minor: -100, balance_bucket: "paid", currency: "USD" },
      ],
      "USD"
    );
    expect(bal.available_minor).toBe(500);
    expect(bal.pending_minor).toBe(200);
    expect(bal.paid_minor).toBe(-100);
  });

  it("allows negative only with explicit recoupment model", () => {
    expect(
      isNegativeBalanceAllowed({ recoupmentModelEnabled: false, availableMinor: -1 })
    ).toBe(false);
    expect(
      isNegativeBalanceAllowed({ recoupmentModelEnabled: true, availableMinor: -1 })
    ).toBe(true);
  });

  it("computes statement totals from ledger kinds", () => {
    const t = computeStatementTotals({
      openingMinor: 100,
      entries: [
        { kind: "royalty_credit", amount_minor: 50 },
        { kind: "fee", amount_minor: -5 },
        { kind: "adjustment", amount_minor: 2 },
        { kind: "payout", amount_minor: -40 },
      ],
    });
    expect(t.closing_minor).toBe(107);
  });
});

describe("Batch 7 payout machine / PAID / eligibility", () => {
  it("extends transitions with under_review and rejected", () => {
    expect(allowedPayoutTransitions("pending")).toContain("under_review");
    expect(allowedPayoutTransitions("under_review")).toContain("approved");
    expect(allowedPayoutTransitions("approved")).toContain("processing");
    expect(canTransitionPayout("processing", "paid").ok).toBe(false);
    expect(canMarkPayoutPaid(["super_admin"])).toBe(false);
  });

  it("requires payment op fields for PAID", () => {
    expect(
      canSetPaidWithPaymentOp({
        paymentReference: "pay_1",
        paidAt: new Date().toISOString(),
        fromStatus: "processing",
      }).ok
    ).toBe(true);
    expect(
      canSetPaidWithPaymentOp({
        paymentReference: "pay_1",
        paidAt: new Date().toISOString(),
        fromStatus: "approved",
      }).ok
    ).toBe(false);
  });

  it("evaluates eligibility with holds / threshold / balance", () => {
    expect(
      evaluatePayoutEligibility({
        accountStatus: "active",
        restrictionKind: "none",
        complianceHoldActive: true,
        availableMinor: 10000,
        amountMinor: 5000,
        currency: "USD",
        minThresholdMinor: 5000,
        payoutsEnabled: true,
      }).eligible
    ).toBe(false);
    expect(
      evaluatePayoutEligibility({
        accountStatus: "active",
        restrictionKind: "none",
        complianceHoldActive: false,
        availableMinor: 10000,
        amountMinor: 5000,
        currency: "USD",
        minThresholdMinor: 5000,
        payoutsEnabled: true,
      }).eligible
    ).toBe(true);
  });
});

describe("Batch 7 payment provider not-connected", () => {
  beforeEach(async () => {
    const { __resetPaymentProviderCacheForTests } = await import("./payment");
    __resetPaymentProviderCacheForTests();
  });

  it("defaults to not connected and refuses createPayout", async () => {
    const { getPaymentProvider, getPaymentConnectionState, PaymentProviderNotConnectedError } =
      await import("./payment");
    const state = getPaymentConnectionState();
    expect(state.connected).toBe(false);
    const p = getPaymentProvider();
    expect(p.connected).toBe(false);
    await expect(
      p.createPayout({
        payoutId: "x",
        amountMinor: 100,
        currency: "USD",
      })
    ).rejects.toBeInstanceOf(PaymentProviderNotConnectedError);
  });

  it("webhook verification fails closed without secret", async () => {
    const prev = process.env.PAYMENT_WEBHOOK_SECRET;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const { verifyPayoutWebhookSignature } = await import("./payment");
    expect(
      verifyPayoutWebhookSignature({ rawBody: "{}", signatureHeader: "abc" }).ok
    ).toBe(false);
    if (prev !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = prev;
  });
});

describe("Batch 7 FX / multi-currency", () => {
  it("never silently converts without rate", () => {
    expect(convertMinorUnitsWithRate({ amountMinor: 100, rate: null }).ok).toBe(false);
    expect(findFxRate([], "USD", "EUR", "2026-09-13")).toBeNull();
    expect(fxUnavailableMessage("USD", "EUR")).toMatch(/UNAVAILABLE/);
  });
});

describe("Batch 7 publishing", () => {
  it("validates publishing shares ≤100% per right/territory", () => {
    expect(
      validatePublishingShares([
        { partyId: "a", rightType: "performance", shareBps: 5000 },
        { partyId: "b", rightType: "performance", shareBps: 5000 },
      ]).ok
    ).toBe(true);
    expect(
      validatePublishingShares([
        { partyId: "a", rightType: "mechanical", shareBps: 6000 },
        { partyId: "b", rightType: "mechanical", shareBps: 5000 },
      ]).ok
    ).toBe(false);
  });

  it("documents no fake collection/registration claims", () => {
    expect(NO_FAKE_COLLECTION_MESSAGE).toMatch(/UNAVAILABLE/);
    expect(NO_FAKE_REGISTRATION_MESSAGE).toMatch(/not claimed/);
  });
});

describe("Batch 7 email / exports / RLS concepts", () => {
  it("only enqueues pending/queued email statuses", () => {
    expect(allowedEnqueueStatuses()).toEqual(["pending", "queued"]);
    expect(BATCH7_EMAIL_TEMPLATES).toContain("payout_paid");
    expect(BATCH7_EMAIL_TEMPLATES).not.toContain("sent_fake");
  });

  it("allowlists finance report export types", () => {
    expect(isAllowedFinanceReportType("ledger_entries")).toBe(true);
    expect(isAllowedFinanceReportType("random")).toBe(false);
  });

  it("RLS concept: staff vs owner; PAID never role-granted", () => {
    expect(canMarkPayoutPaid(["admin"])).toBe(false);
    expect(canMarkPayoutPaid(["support"])).toBe(false);
  });
});

describe("Batch 7 hostile PAID path", () => {
  it("app refuses PAID without connected provider", async () => {
    const { getPaymentConnectionState } = await import("./payment");
    expect(getPaymentConnectionState().connected).toBe(false);
    expect(canSetPaidWithPaymentOp({ paymentReference: "x", paidAt: null }).ok).toBe(false);
  });
});


describe("Batch 7 payout webhook hardening", () => {
  it("does not confuse an external payout id with an event id", () => {
    const payload = { payout_id: "provider_payout_123", status: "paid" };
    expect(extractPayoutWebhookEventId(payload)).toBeNull();
    expect(extractProviderPayoutReference(payload)).toBe("provider_payout_123");
  });

  it("derives deterministic idempotency when no provider event id is supplied", () => {
    const raw = JSON.stringify({ payout_id: "provider_payout_123", status: "paid" });
    const a = extractPayoutWebhookEventId(JSON.parse(raw), raw);
    const b = extractPayoutWebhookEventId(JSON.parse(raw), raw);
    expect(a).toMatch(/^body_[0-9a-f]{64}$/);
    expect(b).toBe(a);
  });

  it("maps only explicit terminal payout statuses", () => {
    expect(extractPayoutMappedStatus({ status: "paid" })).toBe("paid");
    expect(extractPayoutMappedStatus({ type: "payout.completed" })).toBe("paid");
    expect(extractPayoutMappedStatus({ type: "payout.failed" })).toBe("failed");
    expect(extractPayoutMappedStatus({ type: "payout.unpaid" })).toBeNull();
    expect(extractPayoutMappedStatus({ status: "processing" })).toBeNull();
  });

  it("extracts payment reference from nested payloads", () => {
    expect(
      extractPayoutPaymentReference({
        data: { payout: { payment_reference: "bank_ref_123" } },
      })
    ).toBe("bank_ref_123");
  });
});
