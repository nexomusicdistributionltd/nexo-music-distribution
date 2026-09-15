"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey, configured } = getSupabaseEnv();
  const safeUrl = configured ? url : "https://placeholder.supabase.co";
  const safeKey = configured ? anonKey : "public-anon-key";
  // PKCE is default in @supabase/ssr and rejects implicit `#access_token` URLs.
  // Recovery emails still deliver hash tokens — consume them via setSession, not detectSessionInUrl.
  return createBrowserClient(safeUrl, safeKey, {
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}
