/**
 * Admin list pages must not uncaught-throw on missing tables / PostgREST relation errors.
 * Empty and error states are truthful — never invent rows.
 */

export type AdminQueryErrorKind = "missing_relation" | "query" | null;

export type AdminListResult<T> = {
  items: T[];
  error: string | null;
  errorKind: AdminQueryErrorKind;
};

const MISSING_RELATION_CODES = new Set(["42P01", "PGRST200", "PGRST205"]);

export function isMissingRelationError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").trim();
  if (MISSING_RELATION_CODES.has(code)) return true;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return /does not exist|schema cache|could not find a relationship|relation .* does not exist/i.test(
    text
  );
}

export function adminListErrorMessage(
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  fallback = "Could not load this list."
): string {
  if (!error) return fallback;
  if (isMissingRelationError(error)) {
    return "This record set is not available yet (missing table or relation). After migrations apply, real rows will appear — nothing is invented.";
  }
  const message = (error.message ?? "").trim();
  if (!message) return fallback;
  if (/permission denied|row-level security|SQLSTATE|PGRST/i.test(message)) {
    return fallback;
  }
  return message.slice(0, 220);
}

export function unwrapAdminList<T>(result: {
  data: T[] | null;
  error: { message?: string; code?: string; details?: string; hint?: string } | null;
}): AdminListResult<T> {
  if (result.error) {
    return {
      items: [],
      error: adminListErrorMessage(result.error),
      errorKind: isMissingRelationError(result.error) ? "missing_relation" : "query",
    };
  }
  return { items: result.data ?? [], error: null, errorKind: null };
}

export function caughtAdminQueryError(error: unknown, fallback = "Could not load this list."): AdminListResult<never> {
  const extracted =
    error && typeof error === "object"
      ? (error as { message?: string; code?: string; details?: string; hint?: string })
      : { message: error instanceof Error ? error.message : undefined };
  return {
    items: [],
    error: adminListErrorMessage(extracted, fallback),
    errorKind: isMissingRelationError(extracted) ? "missing_relation" : "query",
  };
}
