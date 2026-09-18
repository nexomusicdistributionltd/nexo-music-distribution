"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/** RLS-filtered realtime refresh for portal and staff operations. */
export function RealtimeRefresh({
  userId,
  staff = false,
}: {
  userId: string;
  staff?: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let channel = supabase
      .channel(`${staff ? "staff" : "portal"}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "releases", ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }) },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", ...(staff ? {} : { filter: `requester_user_id=eq.${userId}` }) },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_pitch_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_subscriptions",
          ...(staff ? {} : { filter: `user_id=eq.${userId}` }),
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portal_service_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "music_video_submissions",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payout_requests",
          ...(staff ? {} : { filter: `owner_user_id=eq.${userId}` }),
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "identity_verifications",
          ...(staff ? {} : { filter: `user_id=eq.${userId}` }),
        },
        () => router.refresh()
      );

    if (staff) {
      channel = channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "qc_queue_items" },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contact_messages" },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "newsletter_subscribers" },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "provider_webhook_events" },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles" },
          () => router.refresh()
        );
    }

    channel.subscribe();

    const refresh = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [userId, staff, router]);

  return null;
}
