/**
 * Production-safe API / action error messages.
 * Never echo stacks, SQL, connection strings, or secrets.
 */

const SECRETISH =
  /(password|secret|api[_-]?key|service[_-]?role|authorization|bearer\s+|postgres:\/\/|postgresql:\/\/|smtp_password)/i;

export function publicErrorMessage(
  error: unknown,
  fallback = "Request failed."
): string {
  if (error == null) return fallback;
  if (typeof error === "string") {
    if (SECRETISH.test(error) || error.length > 300) return fallback;
    // Strip PostgREST / Postgres internals
    if (/permission denied|row-level security|violates|SQLSTATE|PGRST/i.test(error)) {
      return "Request could not be completed.";
    }
    return error.slice(0, 200);
  }
  if (error instanceof Error) {
    return publicErrorMessage(error.message, fallback);
  }
  return fallback;
}

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return Response.json(
    { ok: false, error: publicErrorMessage(message), ...extra },
    { status }
  );
}
