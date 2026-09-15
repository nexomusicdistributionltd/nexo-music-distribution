"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Soft realtime refresh for *public* published catalog surfaces only.
 * Relies on RLS so private admin/finance rows are never exposed to anon.
 */
export function PublicCatalogRealtime({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel("public-website-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "releases" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artist_profiles" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "website_videos" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "website_settings" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return null;
}
