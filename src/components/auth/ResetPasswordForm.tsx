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

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(friendlyAuthError(err, "Could not update password. Request a new reset link."));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Alert variant="success" title="Password updated">
        Redirecting you to login…
      </Alert>
    );
  }

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
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
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
