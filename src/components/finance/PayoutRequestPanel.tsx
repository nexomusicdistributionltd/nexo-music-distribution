"use client";

import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  quotePayoutAction,
  requestConfiguredPayoutAction,
  type SafePayoutMethodRow,
} from "@/app/(portal)/earnings/payouts/actions";
import {
  formatMinorUnitsExact,
  parseMajorUnitsExact,
} from "@/lib/finance/exact-money";
import type { PayoutQuote } from "@/lib/finance/payout-quote";

type Balance = { currency: string; available_minor: string };
type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimal_precision: number;
};

function requestToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `portal:${crypto.randomUUID()}`;
  }
  return `portal:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function PayoutRequestPanel({
  balances,
  methods,
  currencies,
}: {
  balances: Balance[];
  methods: SafePayoutMethodRow[];
  currencies: Currency[];
}) {
  const usableMethods = methods.filter((method) => method.status === "active");
  const [sourceCurrency, setSourceCurrency] = React.useState(
    balances.find((balance) => BigInt(balance.available_minor || "0") > 0n)?.currency ??
      balances[0]?.currency ??
      "USD"
  );
  const [payoutMethodId, setPayoutMethodId] = React.useState(
    usableMethods.find((method) => method.is_preferred)?.id ?? usableMethods[0]?.id ?? ""
  );
  const [amountDisplay, setAmountDisplay] = React.useState("");
  const [quote, setQuote] = React.useState<PayoutQuote | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const tokenRef = React.useRef(requestToken());

  const sourceConfig = currencies.find((item) => item.code === sourceCurrency);
  const destinationConfig = quote
    ? currencies.find((item) => item.code === quote.destinationCurrency)
    : null;
  const currentBalance = balances.find((balance) => balance.currency === sourceCurrency);
  const amountMinor = parseMajorUnitsExact(
    amountDisplay,
    sourceConfig?.decimal_precision ?? 2
  );

  React.useEffect(() => {
    setQuote(null);
    setConfirmed(false);
    tokenRef.current = requestToken();
  }, [sourceCurrency, payoutMethodId, amountDisplay]);

  async function prepareQuote() {
    if (!amountMinor || !payoutMethodId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await quotePayoutAction({
        amountMinor,
        sourceCurrency,
        payoutMethodId,
      });
      if (!result.ok) {
        setQuote(null);
        setMessage({ ok: false, text: result.error });
        return;
      }
      setQuote(result.data);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }

  async function submitPayout() {
    if (!quote || !confirmed || !amountMinor) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await requestConfiguredPayoutAction({
        amountMinor,
        sourceCurrency,
        payoutMethodId,
        idempotencyKey: tokenRef.current,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({
        ok: true,
        text: `Payout ${result.data.payoutReference} was submitted and is awaiting review.`,
      });
      setQuote(null);
      setAmountDisplay("");
      setConfirmed(false);
      tokenRef.current = requestToken();
    } finally {
      setBusy(false);
    }
  }

  const sourceSymbol = sourceConfig?.symbol;
  const destinationSymbol = destinationConfig?.symbol;
  const sourcePrecision = sourceConfig?.decimal_precision ?? 2;
  const destinationPrecision = destinationConfig?.decimal_precision ?? 2;

  return (
    <section className="space-y-5 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 sm:p-5">
      <div>
        <h2 className="text-h4">Request payout</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Your final eligibility, balance, limits, fees, security hold and provider route are checked again when you confirm.
        </p>
      </div>

      {balances.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => {
            const config = currencies.find((item) => item.code === balance.currency);
            return (
              <div key={balance.currency} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                <p className="text-caption text-[var(--nexo-text-muted)]">Available royalties</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatMinorUnitsExact(
                    balance.available_minor,
                    balance.currency,
                    config?.decimal_precision ?? 2,
                    config?.symbol
                  )}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">{balance.currency}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <Alert variant="warning">No available royalty balance is currently posted to your ledger.</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-caption font-medium">Source currency</span>
          <Select
            value={sourceCurrency}
            onChange={(event) => setSourceCurrency(event.target.value)}
          >
            {balances.map((balance) => (
              <option key={balance.currency} value={balance.currency}>
                {balance.currency} · {formatMinorUnitsExact(
                  balance.available_minor,
                  balance.currency,
                  currencies.find((item) => item.code === balance.currency)?.decimal_precision ?? 2,
                  currencies.find((item) => item.code === balance.currency)?.symbol
                )}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-caption font-medium">Payout method</span>
          <Select
            value={payoutMethodId}
            onChange={(event) => setPayoutMethodId(event.target.value)}
            disabled={!usableMethods.length}
          >
            {!usableMethods.length ? <option value="">No active payout method</option> : null}
            {usableMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.is_preferred ? "Default · " : ""}
                {method.display_name} · {method.destination_mask}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-caption font-medium">Requested amount ({sourceCurrency})</span>
          <Input
            type="text"
            inputMode="decimal"
            value={amountDisplay}
            placeholder={sourcePrecision ? "0.00" : "0"}
            onChange={(event) => setAmountDisplay(event.target.value)}
          />
          {currentBalance ? (
            <span className="block text-caption text-[var(--nexo-text-muted)]">
              Available: {formatMinorUnitsExact(
                currentBalance.available_minor,
                sourceCurrency,
                sourcePrecision,
                sourceSymbol
              )}
            </span>
          ) : null}
        </label>
      </div>

      {!usableMethods.length ? (
        <Alert variant="warning">Add an active payout method before requesting a payout.</Alert>
      ) : null}

      {!quote ? (
        <Button
          type="button"
          disabled={busy || !amountMinor || !payoutMethodId}
          onClick={() => void prepareQuote()}
        >
          {busy ? "Checking payout…" : "Review payout"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
            <h3 className="font-medium">Payout summary</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-small sm:grid-cols-2">
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Available balance</dt>
                <dd>{formatMinorUnitsExact(quote.availableMinor, quote.sourceCurrency, sourcePrecision, sourceSymbol)}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Withdrawal</dt>
                <dd>{formatMinorUnitsExact(quote.grossMinor, quote.sourceCurrency, sourcePrecision, sourceSymbol)}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Payout method</dt>
                <dd>{quote.methodName} · {quote.destinationMask}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Provider route</dt>
                <dd>{quote.providerName}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Provider fee</dt>
                <dd>{formatMinorUnitsExact(quote.providerFeeMinor, quote.sourceCurrency, sourcePrecision, sourceSymbol)}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">Nexo fee</dt>
                <dd>{formatMinorUnitsExact(quote.nexoFeeMinor, quote.sourceCurrency, sourcePrecision, sourceSymbol)}</dd>
              </div>
              <div>
                <dt className="text-caption text-[var(--nexo-text-muted)]">FX fee</dt>
                <dd>{formatMinorUnitsExact(quote.fxFeeMinor, quote.sourceCurrency, sourcePrecision, sourceSymbol)}</dd>
              </div>
              {quote.sourceCurrency !== quote.destinationCurrency ? (
                <div>
                  <dt className="text-caption text-[var(--nexo-text-muted)]">Exchange rate</dt>
                  <dd className="font-mono text-caption">
                    {quote.fxRateNumerator} / {quote.fxRateDenominator}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2 rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] p-3">
                <dt className="text-caption text-[var(--nexo-text-muted)]">Expected recipient amount</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {formatMinorUnitsExact(
                    quote.recipientMinor,
                    quote.destinationCurrency,
                    destinationPrecision,
                    destinationSymbol
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <label className="flex gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-small">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>I have reviewed the payout amount, destination, fees and currency conversion shown above.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !confirmed} onClick={() => void submitPayout()}>
              {busy ? "Submitting…" : "Confirm withdrawal"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setQuote(null)}>
              Change details
            </Button>
          </div>
        </div>
      )}

      {message ? <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert> : null}
    </section>
  );
}
