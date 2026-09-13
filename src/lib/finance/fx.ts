/** Multi-currency / FX architecture — no silent conversion. */

export type FxRateRow = {
  base_currency: string;
  quote_currency: string;
  rate_numeric: number;
  as_of_date: string;
  source: string;
};

export function findFxRate(
  rates: FxRateRow[],
  base: string,
  quote: string,
  asOf: string
): FxRateRow | null {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  if (b === q) {
    return {
      base_currency: b,
      quote_currency: q,
      rate_numeric: 1,
      as_of_date: asOf,
      source: "identity",
    };
  }
  const candidates = rates
    .filter(
      (r) =>
        r.base_currency.toUpperCase() === b &&
        r.quote_currency.toUpperCase() === q &&
        r.as_of_date <= asOf &&
        r.source !== "unavailable"
    )
    .sort((a, c) => (a.as_of_date < c.as_of_date ? 1 : -1));
  return candidates[0] ?? null;
}

export function fxUnavailableMessage(base: string, quote: string): string {
  return `FX rate UNAVAILABLE for ${base.toUpperCase()}→${quote.toUpperCase()}. No silent conversion.`;
}
