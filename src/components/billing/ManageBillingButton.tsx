"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function ManageBillingButton() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error || "Could not open the customer portal.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the customer portal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button type="button" className="rounded-full" onClick={() => void openPortal()} disabled={loading}>
        {loading ? "Opening portal…" : "Manage billing"}
      </Button>
    </div>
  );
}
