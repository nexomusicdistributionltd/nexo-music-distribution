"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/auth/PasswordField";
import { evaluateAdministratorLogin } from "@/lib/admin/permissions";
import { friendlyAuthError } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/safeRedirect";
import { isBlockedStatus, type AppRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type LoginFormMode = "default" | "administrator";

export function LoginForm({
  mode = "default",
}: {
  mode?: LoginFormMode;
} = {}) {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [accessDenied, setAccessDenied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const configured = getSupabaseEnv().configured;
  const isAdministrator = mode === "administrator";

  const reason = search.get("reason");
  const reasonMessage =
    reason === "supabase-not-configured"
      ? "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
      : reason === "account-blocked"
        ? "This account is suspended or deactivated. Contact support if you need help."
        : reason === "auth-required"
          ? "Please sign in to continue."
          : reason === "access-denied"
            ? "This account does not have administrator access."
            : reason === "password-updated"
              ? "Password updated. Sign in with your new password."
              : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAccessDenied(false);
    if (!configured) {
      setError("Authentication is not configured yet.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;

      const userId = data.user?.id;
      if (!userId) throw new Error("No user");

      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (isBlockedStatus(profile?.account_status)) {
        await supabase.auth.signOut();
        setError("This account is suspended or deactivated.");
        return;
      }

      const roles = (roleRows ?? []).map((r) => r.role as AppRole);

      if (isAdministrator) {
        const gate = evaluateAdministratorLogin(roles);
        if (!gate.ok) {
          await supabase.auth.signOut();
          setAccessDenied(true);
          setError(gate.message ?? "Access denied.");
          return;
        }
      }

      try {
        await supabase.rpc("write_audit_log", {
          p_action: "login",
          p_entity_type: "user",
          p_entity_id: userId,
          p_metadata: {
            method: "password",
            ...(isAdministrator ? { entry: "nexo-admin" } : {}),
          },
        });
      } catch {
        /* ignore audit errors */
      }

      if (!data.user?.email_confirmed_at) {
        router.replace("/verify-email");
        router.refresh();
        return;
      }

      if (isAdministrator) {
        const from = search.get("from") ?? "/admin";
        router.replace(safeRedirectPath(from, roles, "/admin"));
        router.refresh();
        return;
      }

      const from = search.get("from");
      router.replace(safeRedirectPath(from, roles));
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {reasonMessage ? <Alert variant="warning">{reasonMessage}</Alert> : null}
      {error ? (
        <Alert variant="error" title={accessDenied ? "Access denied" : "Could not sign in"}>
          {error}
        </Alert>
      ) : null}
      {!configured ? (
        <Alert variant="warning" title="Setup required">
          Set <code className="text-caption">NEXT_PUBLIC_SUPABASE_*</code> env vars to enable login.
        </Alert>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-label">Email</span>
        <Input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-caption text-[var(--nexo-text-muted)] underline-offset-4 hover:text-[var(--nexo-text)] hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full rounded-full" disabled={loading || !configured}>
        {loading ? "Signing you in…" : isAdministrator ? "Sign in as administrator" : "Sign in"}
      </Button>
    </form>
  );
}
