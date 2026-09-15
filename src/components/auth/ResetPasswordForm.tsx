"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { friendlyAuthError } from "@/lib/auth/errors";
import { validatePassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm({ initialReason }: { initialReason?: string | null } = {}) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(
    initialReason === "invalid-or-expired"
      ? "This reset link is invalid or expired. Request a new one."
      : null
  );
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [sessionReady, setSessionReady] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function check() {
      const { data, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;
      setSessionReady(Boolean(data.user) && !userError);
      setChecking(false);
    }

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(Boolean(session?.user));
        setChecking(false);
        setError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const strength = validatePassword(password);
    if (!strength.ok) {
      setError(`Password needs: ${strength.errors.join(", ")}.`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: userData, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !userData.user) {
        setSessionReady(false);
        throw new Error("expired");
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setPassword("");
      setConfirm("");
      await supabase.auth.signOut();
      setTimeout(() => {
        router.replace("/login?reason=password-updated");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(friendlyAuthError(err, "Could not update password. Request a new reset link."));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Alert variant="success" title="Password updated">
        Redirecting you to sign in…
      </Alert>
    );
  }

  if (checking) {
    return <p className="text-small text-[var(--nexo-text-muted)]">Verifying reset link…</p>;
  }

  if (!sessionReady) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Reset link required">
          {error ??
            "This page needs a valid reset link from your email. Request a new one and open it on this site."}
        </Alert>
        <p className="text-center text-caption text-[var(--nexo-text-muted)]">
          <Link
            href="/forgot-password"
            className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  const submitDisabled = loading || !sessionReady;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <PasswordField
        label="New password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        showStrength
      />
      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      <Button type="submit" className="w-full rounded-full" disabled={submitDisabled}>
        {loading ? "Updating password…" : "Update password"}
      </Button>
      <p className="text-center text-caption text-[var(--nexo-text-muted)]">
        <Link href="/login" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
          Back to login
        </Link>
      </p>
    </form>
  );
}
