"use client";

import { LOGOUT_API_PATH } from "@/lib/auth/login-otp/constants";
import { loginHref } from "@/lib/auth/login-otp/paths";
import { createClient } from "@/lib/supabase/client";

function clearNexoClientCache() {
  if (typeof window === "undefined") return;
  try {
    const storages: Storage[] = [];
    try {
      storages.push(window.sessionStorage);
    } catch {
      /* ignore */
    }
    try {
      storages.push(window.localStorage);
    } catch {
      /* ignore */
    }
    for (const storage of storages) {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k) continue;
        if (k.startsWith("nexo") || k.startsWith("nexo_")) keys.push(k);
      }
      for (const k of keys) storage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Real logout for Artist / Label / Admin:
 * server invalidates OTP + verified second-step, client signOut(),
 * realtime teardown, cache clear, full navigation to /login.
 */
export async function performClientLogout(): Promise<string> {
  const supabase = createClient();

  try {
    await fetch(LOGOUT_API_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "cache-control": "no-store" },
    });
  } catch {
    /* still sign out locally */
  }

  try {
    await supabase.removeAllChannels();
  } catch {
    /* ignore */
  }

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }

  clearNexoClientCache();
  return loginHref();
}

export function hardRedirectToLogin() {
  const href = loginHref();
  if (typeof window !== "undefined") {
    window.location.replace(href);
    return;
  }
}
