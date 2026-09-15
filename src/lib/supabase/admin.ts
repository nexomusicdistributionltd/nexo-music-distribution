import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Canonical + documented aliases for the privileged Supabase key.
 * Never read NEXT_PUBLIC_* here. Never fall back to the anon key.
 */
export const SERVICE_ROLE_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_SECRET_KEY",
] as const;

export class ServiceRoleUnavailableError extends Error {
  constructor() {
    super(
      "Service role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
    this.name = "ServiceRoleUnavailableError";
  }
}

export type ServiceRoleKeyStatus = "present" | "absent" | "invalid_anon";

function firstNonEmpty(env: NodeJS.ProcessEnv, names: readonly string[]): string {
  for (const name of names) {
    const value = (env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/** Server-only. Never import this module from client components. */
export function getServiceRoleKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = firstNonEmpty(env, SERVICE_ROLE_ENV_NAMES);
  if (!key) return "";
  const anon = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (anon && key === anon) return "";
  return key;
}

export function getServiceRoleKeyStatus(
  env: NodeJS.ProcessEnv = process.env
): ServiceRoleKeyStatus {
  const raw = firstNonEmpty(env, SERVICE_ROLE_ENV_NAMES);
  if (!raw) return "absent";
  const anon = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (anon && raw === anon) return "invalid_anon";
  return "present";
}

/** Privileged Supabase client. Bypasses RLS — use only in trusted server jobs. */
export function createServiceClient() {
  const { url } = getSupabaseEnv();
  const key = getServiceRoleKey();
  if (!url || !key) {
    throw new ServiceRoleUnavailableError();
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
