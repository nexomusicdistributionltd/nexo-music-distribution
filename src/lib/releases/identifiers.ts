/** ISRC / UPC policy — never overwrite existing; never fabricate. */

export function preserveExistingUpc(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null | undefined {
  const current = existing?.trim() || null;
  if (current) return current;
  if (incoming === undefined) return undefined;
  return incoming?.trim() || null;
}

export function preserveExistingIsrc(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null | undefined {
  const current = existing?.trim() || null;
  if (current) return current;
  if (incoming === undefined) return undefined;
  return incoming?.trim().toUpperCase() || null;
}

export function applyUpcPreserveGuard(
  safe: Record<string, unknown>,
  existingUpc: string | null | undefined
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(safe, "upc")) return safe;
  if (existingUpc?.trim()) {
    const { upc: _drop, ...rest } = safe;
    void _drop;
    return rest;
  }
  const preserved = preserveExistingUpc(existingUpc, safe.upc as string | null);
  return { ...safe, upc: preserved ?? null };
}
