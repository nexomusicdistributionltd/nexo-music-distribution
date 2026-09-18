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
  allowUnverifiedIdentity?: boolean;
  allowUnsignedAgreement?: boolean;
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

  const isStaff =
    ctx.roles.includes("support") ||
    ctx.roles.includes("admin") ||
    ctx.roles.includes("super_admin");
  const isArtistOrLabel =
    ctx.roles.includes("artist") || ctx.roles.includes("label");

  if (!isStaff && isArtistOrLabel) {
    const supabase = await (await import("@/lib/supabase/server")).createClient();
    if (!options?.allowUnverifiedIdentity) {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("status")
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error || data?.status !== "verified") {
        redirect("/verify-identity");
      }
    }

    if (!options?.allowUnsignedAgreement) {
      const { data: agreement, error: agreementError } = await supabase
        .from("distribution_agreements")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("status", "signed")
        .limit(1)
        .maybeSingle();

      if (agreementError || !agreement) {
        redirect("/distribution-agreement");
      }
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
  options?: { redirectTo?: string; allowUnverifiedIdentity?: boolean; allowUnsignedAgreement?: boolean }
): Promise<AuthUserContext> {
  const ctx = await RequireAuth(options);
  if (!ctx.emailVerified) {
    redirect("/verify-email");
  }
  return ctx;
}

export async function RequireRole(
  allowed: AppRole | AppRole[],
  options?: { redirectTo?: string; allowUnverifiedIdentity?: boolean; allowUnsignedAgreement?: boolean }
): Promise<AuthUserContext> {
  const ctx = await RequireVerifiedEmail(options);
  const list = Array.isArray(allowed) ? allowed : [allowed];
  const ok = list.some((r) => ctx.roles.includes(r));
  if (!ok) {
    redirect(homePathForRoles(ctx.roles));
  }
  return ctx;
}

export async function RequireVerifiedPortal(): Promise<AuthUserContext> {
  return RequireRole(["artist", "label"]);
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
