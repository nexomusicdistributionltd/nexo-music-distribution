import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, AuthUserContext, Profile } from "@/lib/auth/types";
import { getSupabaseEnv } from "@/lib/supabase/env";

const APP_ROLES = new Set<AppRole>([
  "public_user",
  "artist",
  "label",
  "support",
  "admin",
  "super_admin",
]);

type RequestGuardRpc = {
  profile?: Profile | null;
  roles?: unknown;
  otp_verified?: boolean;
  identity_status?: string | null;
};

export type AuthGuardBundle = {
  ctx: AuthUserContext | null;
  otpVerified: boolean;
  identityStatus: string | null;
};

function primaryRoleFor(roles: AppRole[]): AppRole | null {
  return (
    roles.find((r) => r === "super_admin") ??
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "support") ??
    roles.find((r) => r === "label") ??
    roles.find((r) => r === "artist") ??
    roles[0] ??
    null
  );
}

const readAuthGuardBundle = cache(async (): Promise<AuthGuardBundle> => {
  const { configured } = getSupabaseEnv();
  if (!configured) {
    return { ctx: null, otpVerified: false, identityStatus: null };
  }

  const supabase = await createClient();

  // Run the trusted auth check and the current-user guard snapshot together.
  // We never trust the RPC alone: a valid auth.getUser() result is still
  // required before any user context is returned.
  const [authResult, guardResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("nexo_request_guard_context"),
  ]);

  const user = authResult.data.user;
  if (!user) {
    return { ctx: null, otpVerified: false, identityStatus: null };
  }

  let profile: Profile | null = null;
  let roles: AppRole[] = [];
  let otpVerified = false;
  let identityStatus: string | null = null;

  if (!guardResult.error && guardResult.data && typeof guardResult.data === "object") {
    const guard = guardResult.data as RequestGuardRpc;
    profile = (guard.profile as Profile | null | undefined) ?? null;
    roles = Array.isArray(guard.roles)
      ? guard.roles.filter(
          (value): value is AppRole =>
            typeof value === "string" && APP_ROLES.has(value as AppRole)
        )
      : [];
    otpVerified = guard.otp_verified === true;
    identityStatus =
      typeof guard.identity_status === "string" ? guard.identity_status : null;
  } else {
    // Safe compatibility fallback for local/dev environments that have not
    // applied the performance migration yet. These run in parallel.
    const [{ data: profileRow }, { data: roleRows }, { data: otpOk }, { data: identity }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.rpc("nexo_login_otp_verified"),
        supabase
          .from("identity_verifications")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    profile = (profileRow as Profile | null) ?? null;
    roles = (roleRows ?? [])
      .map((row) => row.role as AppRole)
      .filter((role) => APP_ROLES.has(role));
    otpVerified = otpOk === true;
    identityStatus =
      typeof identity?.status === "string" ? identity.status : null;
  }

  const ctx: AuthUserContext = {
    userId: user.id,
    email: user.email ?? profile?.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    profile,
    roles,
    primaryRole: primaryRoleFor(roles),
  };

  return { ctx, otpVerified, identityStatus };
});

/**
 * Request-scoped auth + authorization guard snapshot.
 *
 * The normal path is two parallel network calls total:
 * - Supabase auth.getUser() for authoritative authentication
 * - one RPC for profile + roles + OTP + identity state
 *
 * This replaces several serial database roundtrips on every Server Action.
 */
export async function getAuthGuardBundle(): Promise<AuthGuardBundle> {
  return readAuthGuardBundle();
}

export async function getAuthContext(): Promise<AuthUserContext | null> {
  return (await readAuthGuardBundle()).ctx;
}

export async function writeAudit(
  action:
    | "login"
    | "logout"
    | "profile_update"
    | "role_change"
    | "status_change"
    | "signup"
    | "password_reset_request"
    | "email_verified"
    | "login_password_success"
    | "otp_sent"
    | "otp_resent"
    | "otp_failed"
    | "otp_verified"
    | "otp_expired",
  metadata: Record<string, unknown> = {}
) {
  try {
    const supabase = await createClient();
    // Strip secrets defensively
    const safe = { ...metadata };
    delete safe.password;
    delete safe.token;
    delete safe.access_token;
    delete safe.refresh_token;
    delete safe.otp;
    delete safe.otp_code;
    delete safe.code_hash;
    delete safe.plaintext_otp;
    await supabase.rpc("write_audit_log", {
      p_action: action,
      p_entity_type: "user",
      p_entity_id: null,
      p_metadata: safe,
    });
  } catch {
    // Audit must never break the main flow
  }
}
