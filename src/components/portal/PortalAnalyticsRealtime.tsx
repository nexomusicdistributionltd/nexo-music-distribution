"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 60_000;

/**
 * Keeps server-rendered provider analytics current without hammering the
 * upstream API. The provider reference layer already uses a 60-second cache,
 * so refreshing faster would add UI churn without improving freshness.
 */
export function PortalAnalyticsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const interval = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
