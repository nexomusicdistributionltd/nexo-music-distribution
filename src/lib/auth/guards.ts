import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { isCurrentSessionOtpVerified } from "@/lib/auth/login-otp/status";
import { LOGIN_OTP_VERIFY_PATH } from "@/lib/auth/login-otp/constants";
import {
  homePathForRoles,
  isLoginRestricted,
  isReadOnlyRestriction,
  isSubmitBlocked,
  type AppRole,
  type AuthUserContext,
} from "@/lib/auth/types";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin/permissions";
import { getSupabaseEnv } from "@/lib/supabase/env";

function authNotConfiguredRedirect() {
  redirect("/login?reason=supabase-not-configured");
}

export async function RequireAuth(options?: {
  redirectTo?: string;
}): Promise<AuthUserContext> {
  const { configured } = getSupabaseEnv();
  if (!configured) authNotConfiguredRedirect();

  const ctx = await getAuthContext();
  if (!ctx) {
    const next = options?.redirectTo ?? "/login";
    redirect(`${next}${next.includes("?") ? "&" : "?"}reason=auth-required`);
  }

  if (
    isLoginRestricted(
      ctx.profile?.account_status,
      ctx.profile?.restriction_kind
    )
  ) {
    redirect("/login?reason=account-blocked");
  }

  if (ctx.emailVerified) {
    const otpOk = await isCurrentSessionOtpVerified();
    if (!otpOk) {
      redirect(`${LOGIN_OTP_VERIFY_PATH}?reason=otp-required`);
    }
  }

  return ctx;
}

/** Reject mutating portal actions for read_only / submit_blocked accounts. */
export function assertCanMutateCatalog(ctx: AuthUserContext): void {
  if (isReadOnlyRestriction(ctx.profile?.restriction_kind)) {
    throw new Error("Account is read-only.");
  }
}

export function assertCanSubmitRelease(ctx: AuthUserContext): void {
  if (isSubmitBlocked(ctx.profile?.restriction_kind)) {
    throw new Error("Account restriction prevents submitting releases.");
  }
}

export async function RequireVerifiedEmail(
  options?: { redirectTo?: string }
): Promise<AuthUserContext> {
  const ctx = await RequireAuth(options);
  if (!ctx.emailVerified) {
    redirect("/verify-email");
  }
  return ctx;
}

export async function RequireRole(
  allowed: AppRole | AppRole[],
  options?: { redirectTo?: string }
): Promise<AuthUserContext> {
  const ctx = await RequireVerifiedEmail(options);
  const list = Array.isArray(allowed) ? allowed : [allowed];
  const ok = list.some((r) => ctx.roles.includes(r));
  if (!ok) {
    redirect(homePathForRoles(ctx.roles));
  }
  return ctx;
}

/** Admin portal: admin, super_admin, support. */
export async function RequireAdmin(): Promise<AuthUserContext> {
  return RequireRole(["admin", "super_admin", "support"]);
}

/** Strict administrators only (excludes support). Used by /nexo-admin entry. */
export async function RequireAdministrator(): Promise<AuthUserContext> {
  return RequireRole(["admin", "super_admin"]);
}

export async function RequireSuperAdmin(): Promise<AuthUserContext> {
  return RequireRole("super_admin");
}

export async function RequireAdminPermission(
  permission: AdminPermission
): Promise<AuthUserContext> {
  const ctx = await RequireAdmin();
  if (!hasAdminPermission(ctx.roles, permission)) {
    redirect(homePathForRoles(ctx.roles));
  }
  return ctx;
}

/** Soft check for layouts that need optional session. */
export async function getOptionalAuth(): Promise<AuthUserContext | null> {
  const { configured } = getSupabaseEnv();
  if (!configured) return null;
  return getAuthContext();
}
