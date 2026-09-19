export function normalizePageNumber(
  value: string | number | null | undefined,
  fallback = 1
): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.max(1, Math.floor(numeric));
}

export function normalizePageSize(
  value: number | null | undefined,
  fallback: number,
  max: number
): number {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value as number)));
}
