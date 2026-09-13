"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey, configured } = getSupabaseEnv();
  const safeUrl = configured ? url : "https://placeholder.supabase.co";
  const safeKey = configured ? anonKey : "public-anon-key";
  return createBrowserClient(safeUrl, safeKey);
}
