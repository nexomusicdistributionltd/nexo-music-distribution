/** Map Supabase / auth errors to safe user-facing copy (never raw). */
export function friendlyAuthError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return "Please verify your email before signing in.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return "Please choose a stronger password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }
  if (lower.includes("expired") || lower.includes("otp")) {
    return "This link has expired. Request a new one.";
  }
  if (lower.includes("same password")) {
    return "New password must be different from your current password.";
  }
  if (!message) return fallback;
  // Do not leak internal details
  return fallback;
}
