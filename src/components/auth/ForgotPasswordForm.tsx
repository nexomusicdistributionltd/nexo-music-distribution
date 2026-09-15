"use client";

import Link from "next/link";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { friendlyAuthError } from "@/lib/auth/errors";
import { recoveryEmailRedirectTo } from "@/lib/auth/recovery-urls";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const configured = getSupabaseEnv().configured;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError("Authentication is not configured yet.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: recoveryEmailRedirectTo(),
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err, "Could not send reset email. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Alert variant="success" title="Check your email">
        If an account exists for that address, we sent a password reset link. You can close this
        page and follow the email.
        <div className="mt-3">
          <Link href="/login" className="underline underline-offset-4">
            Back to login
          </Link>
        </div>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <label className="block space-y-1.5">
        <span className="text-label">Email</span>
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <Button type="submit" className="w-full rounded-full" disabled={loading || !configured}>
        {loading ? "Sending reset link…" : "Send reset link"}
      </Button>
      <p className="text-center text-caption text-[var(--nexo-text-muted)]">
        <Link href="/login" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
          Back to login
        </Link>
      </p>
    </form>
  );
}
