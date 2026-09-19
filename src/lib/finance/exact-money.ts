export function parseMajorUnitsExact(
  input: string,
  decimalPrecision: number
): string | null {
  const value = input.trim();
  if (!Number.isInteger(decimalPrecision) || decimalPrecision < 0 || decimalPrecision > 8) {
    return null;
  }
  const match = value.match(/^([0-9]+)(?:\.([0-9]+))?$/);
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, "") || "0";
  const fraction = match[2] ?? "";
  if (fraction.length > decimalPrecision) return null;
  const minor = `${whole}${fraction.padEnd(decimalPrecision, "0")}`.replace(
    /^0+(?=\d)/,
    ""
  );
  try {
    const amount = BigInt(minor || "0");
    return amount > 0n ? amount.toString() : null;
  } catch {
    return null;
  }
}

export function formatMinorUnitsExact(
  minorInput: string | number | bigint,
  currency: string,
  decimalPrecision = 2,
  symbol?: string | null
): string {
  let minor: bigint;
  try {
    minor = BigInt(String(minorInput));
  } catch {
    return `${currency} 0`;
  }
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const scale = 10n ** BigInt(Math.max(0, decimalPrecision));
  const whole = scale === 1n ? absolute : absolute / scale;
  const fraction = scale === 1n ? "" : (absolute % scale).toString().padStart(decimalPrecision, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = symbol?.trim() || `${currency} `;
  return `${negative ? "-" : ""}${prefix}${grouped}${fraction ? `.${fraction}` : ""}`;
}
