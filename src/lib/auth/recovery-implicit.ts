import { RESET_PASSWORD_PATH } from "@/lib/auth/recovery-urls";

type RecoveryTokens = {
  access_token: string;
  refresh_token: string;
};

type RecoveryHashResult =
  | { kind: "tokens"; tokens: RecoveryTokens }
  | { kind: "invalid" }
  | { kind: "none" };

function paramsFromHash(hash: string): URLSearchParams | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  return new URLSearchParams(raw);
}

/**
 * Parse a GoTrue implicit recovery fragment.
 * Observed live shape: `#access_token=…&refresh_token=…&type=recovery`
 * Never log or stringify the tokens.
 */
export function parseRecoveryHash(hash: string): RecoveryHashResult {
  const params = paramsFromHash(hash);
  if (!params) return { kind: "none" };

  const type = (params.get("type") ?? "").trim();
  const error = (params.get("error") ?? "").trim();
  const access_token = params.get("access_token") ?? "";
  const refresh_token = params.get("refresh_token") ?? "";

  if (type && type !== "recovery") return { kind: "none" };
  if (!type && !error && !access_token && !refresh_token) return { kind: "none" };
  if (type !== "recovery") return { kind: "none" };

  if (error) return { kind: "invalid" };
  if (!access_token || !refresh_token) return { kind: "invalid" };
  return { kind: "tokens", tokens: { access_token, refresh_token } };
}

/**
 * If implicit recovery tokens landed on Site URL `/` (or any other path),
 * keep the original hash and send the browser to /reset-password.
 * Hash is never sent to the server — do not reconstruct tokens into a new URL.
 */
export function recoveryImplicitReroute(pathname: string, hash: string): string | null {
  const parsed = parseRecoveryHash(hash);
  if (parsed.kind === "none") return null;
  if (pathname === RESET_PASSWORD_PATH || pathname.startsWith(`${RESET_PASSWORD_PATH}/`)) {
    return null;
  }
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  return `${RESET_PASSWORD_PATH}${normalized}`;
}

export function stripLocationHash(pathname: string, search: string): string {
  return `${pathname}${search ?? ""}`;
}

type AuthLike = {
  setSession: (s: RecoveryTokens) => Promise<{ error: { message?: string } | null }>;
  getUser: () => Promise<{ data: { user: unknown | null }; error: unknown }>;
};

/**
 * Establish a recovery session from the implicit hash BEFORE updateUser.
 * PKCE createBrowserClient will not consume `#access_token` on its own.
 */
export async function establishRecoverySessionFromHash(
  auth: AuthLike,
  hash: string
): Promise<"ready" | "invalid" | "none"> {
  const parsed = parseRecoveryHash(hash);
  if (parsed.kind === "none") return "none";
  if (parsed.kind === "invalid") return "invalid";

  const { error } = await auth.setSession(parsed.tokens);
  if (error) return "invalid";

  const { data, error: userError } = await auth.getUser();
  if (userError || !data.user) return "invalid";
  return "ready";
}
