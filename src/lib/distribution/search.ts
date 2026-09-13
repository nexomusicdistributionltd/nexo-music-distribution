/**
 * Sanitize user search input before interpolating into PostgREST `.or()` filters.
 * Strips metacharacters that can inject extra filter clauses (same idea as Batch 5 admin search).
 *
 * Note: privileged release status transitions are NOT unlocked by client-supplied
 * `metadata.source`. SECURITY DEFINER callers must set
 * `nexo.trusted_status_transition=1` (transaction-local GUC) before calling
 * `transition_release_status`. Spoofing `{source:'webhook'}` etc. from a JWT
 * client must fail closed after Batch 6 hostile audit.
 */
export function sanitizeDistributionSearchQuery(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[%_,()."'\\:*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
