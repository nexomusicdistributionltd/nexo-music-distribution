"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/** Refetch server billing state after checkout while the webhook is still catching up. */
export function BillingSyncRefresh() {
  const router = useRouter();

  React.useEffect(() => {
    const refresh = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const t1 = window.setTimeout(refresh, 2500);
    const t2 = window.setTimeout(refresh, 8000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [router]);

  return null;
}
