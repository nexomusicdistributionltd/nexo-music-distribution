/** Thread key from RFC 5322 headers. Used for inbox grouping — never invented from outbound-only rows. */

export function normalizeMessageId(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^<|>$/g, "").trim();
}

export function parseReferences(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /<[^>]+>/g;
  const angled = raw.match(re);
  const tokens = angled ?? raw.split(/\s+/);
  for (const t of tokens) {
    const id = normalizeMessageId(t);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Prefer the root of References, else In-Reply-To, else this Message-ID.
 */
export function threadKeyFromHeaders(opts: {
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const refs = parseReferences(opts.references);
  if (refs[0]) return refs[0];
  const parent = normalizeMessageId(opts.inReplyTo);
  if (parent) return parent;
  const self = normalizeMessageId(opts.messageId);
  return self || "";
}

export function buildReplyHeaders(opts: {
  originalMessageId: string;
  originalReferences?: string | null;
}): { inReplyTo: string; references: string } {
  const id = normalizeMessageId(opts.originalMessageId);
  const angled = id ? `<${id}>` : "";
  const prior = (opts.originalReferences ?? "").trim();
  const references = [prior, angled].filter(Boolean).join(" ").trim();
  return {
    inReplyTo: angled,
    references,
  };
}

export function replySubject(subject: string): string {
  const s = subject.trim() || "(no subject)";
  return /^re\s*:/i.test(s) ? s : `Re: ${s}`;
}
