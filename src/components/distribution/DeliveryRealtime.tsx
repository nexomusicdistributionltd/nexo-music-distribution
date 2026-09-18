"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the admin delivery tracker whenever provider truth changes.
 * Realtime rows remain RLS-protected to staff.
 */
export function DeliveryRealtime() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel("admin-distribution-delivery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_delivery_snapshots" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "distribution_jobs" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_sync_runs" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_webhook_events" },
        refresh
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
