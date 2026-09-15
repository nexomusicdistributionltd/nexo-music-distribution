"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { friendlyAuthError } from "@/lib/auth/errors";
import { authEmailRedirectUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";

export function VerifyEmailPanel({ email }: { email?: string | null }) {
  const search = useSearchParams();
  const registered = search.get("registered") === "1";
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function resend() {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Sign in or register again so we know which email to verify.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authEmailRedirectUrl("/auth/confirm") },
      });
      if (resendError) throw resendError;
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(friendlyAuthError(err, "Could not resend verification email."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {registered ? (
        <Alert variant="success" title="Account created">
          Check your email to verify your address before accessing the full portal.
        </Alert>
      ) : (
        <Alert title="Verify your email">
          Your account has limited access until email verification is complete.
          {email ? (
            <>
              {" "}
              We sent a link to <strong>{email}</strong>.
            </>
          ) : null}
        </Alert>
      )}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        type="button"
        className="w-full rounded-full"
        onClick={resend}
        disabled={loading || !email}
      >
        {loading ? "Sending…" : "Resend verification email"}
      </Button>
      <p className="text-center text-caption text-[var(--nexo-text-muted)]">
        <Link href="/login" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
          Back to login
        </Link>
        {" · "}
        <Link href="/profile" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
          Profile (limited)
        </Link>
      </p>
    </div>
  );
}
