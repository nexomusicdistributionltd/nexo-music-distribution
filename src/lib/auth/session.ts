import { createClient } from "@/lib/supabase/server";
import type { AppRole, AuthUserContext, Profile } from "@/lib/auth/types";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function getAuthContext(): Promise<AuthUserContext | null> {
  const { configured } = getSupabaseEnv();
  if (!configured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const primaryRole =
    roles.find((r) => r === "super_admin") ??
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "support") ??
    roles.find((r) => r === "label") ??
    roles.find((r) => r === "artist") ??
    roles[0] ??
    null;

  return {
    userId: user.id,
    email: user.email ?? profile?.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    profile: (profile as Profile | null) ?? null,
    roles,
    primaryRole,
  };
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
    | "email_verified",
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
