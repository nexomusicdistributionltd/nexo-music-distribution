"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

const REALTIME_REFRESH_DELAY_MS = 300;
const MIN_REFRESH_INTERVAL_MS = 1_000;
const FOCUS_STALE_AFTER_MS = 30_000;

/** RLS-filtered realtime refresh for portal and staff operations. */
export function RealtimeRefresh({
  userId,
  staff = false,
}: {
  userId: string;
  staff?: boolean;
}) {
  const router = useRouter();
  const lastRefreshAt = React.useRef(Date.now());

  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshPendingWhileHidden = false;

    const refreshNow = () => {
      timer = null;
      if (document.visibilityState === "hidden") {
        refreshPendingWhileHidden = true;
        return;
      }

      refreshPendingWhileHidden = false;
      lastRefreshAt.current = Date.now();
      router.refresh();
    };

    const scheduleRefresh = (delay = REALTIME_REFRESH_DELAY_MS) => {
      if (document.visibilityState === "hidden") {
        refreshPendingWhileHidden = true;
        return;
      }

      // Coalesce bursts of related database changes into one RSC refresh.
      if (timer) return;

      const sinceLastRefresh = Date.now() - lastRefreshAt.current;
      const throttleDelay = Math.max(0, MIN_REFRESH_INTERVAL_MS - sinceLastRefresh);
      timer = setTimeout(refreshNow, Math.max(delay, throttleDelay));
    };

    let channel = supabase
      .channel(`${staff ? "staff" : "portal"}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "releases", ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }) },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", ...(staff ? {} : { filter: `requester_user_id=eq.${userId}` }) },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_pitch_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_subscriptions",
          ...(staff ? {} : { filter: `user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portal_service_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "music_video_submissions",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payout_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "identity_verifications",
          ...(staff ? {} : { filter: `user_id=eq.${userId}` }),
        },
        () => scheduleRefresh()
      );

    if (staff) {
      channel = channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "qc_queue_items" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contact_messages" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "newsletter_subscribers" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "provider_webhook_events" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles" },
          () => scheduleRefresh()
        );
    }

    channel.subscribe();

    const refreshIfStale = () => {
      if (
        refreshPendingWhileHidden ||
        Date.now() - lastRefreshAt.current >= FOCUS_STALE_AFTER_MS
      ) {
        scheduleRefresh(0);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };

    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [userId, staff, router]);

  return null;
}
