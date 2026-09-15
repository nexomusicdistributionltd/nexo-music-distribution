/**
 * DDEX Party Identifier (DPID) helpers.
 * MessageHeader PartyId / DetailedPartyId DPID must match PADPIDA[a-zA-Z0-9]+.
 * Hyphenated display form (PA-DPIDA-…-C) is stored in env; compact form is used in XML.
 */

const COMPACT_RE = /^PADPIDA[a-zA-Z0-9]+$/;

export function compactDpid(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!COMPACT_RE.test(compact)) return null;
  return compact;
}

export function assertCompactDpid(raw: string, label: string): string {
  const compact = compactDpid(raw);
  if (!compact) {
    throw new Error(`${label} is not a valid DDEX DPID.`);
  }
  return compact;
}

export function isCompactDpid(raw: string | null | undefined): boolean {
  return compactDpid(raw) != null;
}
