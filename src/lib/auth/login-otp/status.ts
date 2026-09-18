import { cache } from "react";
import { sessionIdFromAccessToken } from "@/lib/auth/login-otp/jwt";
import type { AppRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export type AuthSessionIdentity = {
  userId: string;
  email: string;
  sessionId: string;
  emailConfirmed: boolean;
  roles: AppRole[];
};

export async function getPasswordSessionIdentity(): Promise<AuthSessionIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = sessionIdFromAccessToken(session?.access_token);
  if (!sessionId) return null;

  const email = (user.email ?? "").trim();
  if (!email) return null;

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role as AppRole);

  return {
    userId: user.id,
    email,
    sessionId,
    emailConfirmed: Boolean(user.email_confirmed_at),
    roles,
  };
}

const readCurrentSessionOtpVerified = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("nexo_login_otp_verified");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
});

export async function isCurrentSessionOtpVerified(): Promise<boolean> {
  return readCurrentSessionOtpVerified();
}
