"use client";

import Link from "next/link";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { performClientLogout } from "@/lib/auth/logout-client";

export function AdministratorAccessDenied() {
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await performClientLogout();
      window.location.replace("/nexo-admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="error" title="Access denied">
        This account does not have administrator access to Admin Center. If you use the staff
        portal, sign in from the standard login page instead.
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-full sm:w-auto"
          disabled={loading}
          onClick={signOut}
        >
          {loading ? "Signing out…" : "Sign out"}
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[var(--nexo-border)] px-4 text-small font-medium text-[var(--nexo-text)] hover:bg-[var(--nexo-ghost-hover)] sm:w-auto"
        >
          Home
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-small font-medium text-[var(--nexo-text-muted)] underline-offset-4 hover:text-[var(--nexo-text)] hover:underline sm:w-auto"
        >
          Standard sign-in
        </Link>
      </div>
    </div>
  );
}
