"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "portal_payees",
  "royalty_split_rules",
  "royalty_split_shares",
  "split_track_assignments",
  "portal_recoupments",
  "splitshare_allocations",
] as const;

export function SplitShareRealtime({ ownerUserId }: { ownerUserId?: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 120);
    };

    const channel = supabase.channel(
      `splitshare-live-${ownerUserId ?? "admin"}-${Math.random().toString(36).slice(2)}`
    );

    for (const table of TABLES) {
      const filter =
        ownerUserId && table !== "royalty_split_shares" && table !== "splitshare_allocations"
          ? `owner_user_id=eq.${ownerUserId}`
          : undefined;

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        refresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [ownerUserId, router]);

  return null;
}
