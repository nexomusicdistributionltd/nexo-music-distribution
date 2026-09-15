"use client";

import * as React from "react";
import { recoveryImplicitReroute } from "@/lib/auth/recovery-implicit";

/**
 * GoTrue implicit recovery lands as `#access_token&refresh_token&type=recovery`
 * on Site URL `/` when redirect_to is missing. Move that hash to /reset-password
 * without sending it to the server.
 */
export function RecoveryHashCatcher() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const dest = recoveryImplicitReroute(window.location.pathname, window.location.hash);
    if (dest) {
      window.location.replace(dest);
    }
  }, []);
  return null;
}
