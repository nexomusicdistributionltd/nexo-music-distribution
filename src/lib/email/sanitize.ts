/** Escape user-controlled strings for safe HTML insertion. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeEmailVars(
  vars: Record<string, string | number | null | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) {
      out[k] = "";
      continue;
    }
    out[k] = escapeHtml(String(v));
  }
  return out;
}
