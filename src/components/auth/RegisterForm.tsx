"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PasswordField } from "@/components/auth/PasswordField";
import { COUNTRIES } from "@/lib/auth/countries";
import { friendlyAuthError } from "@/lib/auth/errors";
import { validatePassword } from "@/lib/auth/password";
import type { SignupRole } from "@/lib/auth/types";
import { authEmailRedirectUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { parseBillingSelection, preserveBillingQuery } from "@/lib/billing/auth-return";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const initial: SignupRole =
    search.get("type") === "label" ? "label" : "artist";
  const billingSelection = parseBillingSelection({
    plan: search.get("plan"),
    interval: search.get("interval"),
  });
  const lockedType: SignupRole | null = billingSelection
    ? billingSelection.planId.startsWith("label")
      ? "label"
      : "artist"
    : null;

  const [role, setRole] = React.useState<SignupRole>(lockedType ?? initial);
  const [fullName, setFullName] = React.useState("");
  const [stageOrLabel, setStageOrLabel] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const configured = getSupabaseEnv().configured;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!configured) {
      setError("Authentication is not configured yet.");
      return;
    }
    if (!terms) {
      setError("Please accept the terms to continue.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const strength = validatePassword(password);
    if (!strength.ok) {
      setError(`Password needs: ${strength.errors.join(", ")}.`);
      return;
    }
    if (!country) {
      setError("Please select your country.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const metadata =
        role === "artist"
          ? {
              role: "artist",
              full_name: fullName.trim(),
              display_name: stageOrLabel.trim(),
              stage_name: stageOrLabel.trim(),
              country,
            }
          : {
              role: "label",
              full_name: fullName.trim(),
              contact_name: fullName.trim(),
              display_name: stageOrLabel.trim(),
              label_name: stageOrLabel.trim(),
              business_email: email.trim(),
              country,
            };

      const { error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authEmailRedirectUrl(
            billingSelection
              ? `/auth/confirm?next=${encodeURIComponent(
                  `/pricing?plan=${billingSelection.planId}&interval=${billingSelection.interval}&checkout=1`
                )}`
              : "/auth/confirm"
          ),
          data: metadata,
        },
      });
      if (signError) throw signError;

      const verifyQs = new URLSearchParams({ registered: "1" });
      if (billingSelection) {
        verifyQs.set("plan", billingSelection.planId);
        verifyQs.set("interval", billingSelection.interval);
      }
      const from = search.get("from");
      if (from?.startsWith("/") && !from.startsWith("//")) verifyQs.set("from", from);
      router.replace(`/verify-email?${verifyQs.toString()}`);
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err, "Could not create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="error" title="Registration issue">{error}</Alert> : null}
      {!configured ? (
        <Alert variant="warning" title="Setup required">
          Configure Supabase env vars before registering.
        </Alert>
      ) : null}

      <div
        className="grid grid-cols-2 gap-2 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-1"
        role="tablist"
        aria-label="Account type"
      >
        {(["artist", "label"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            disabled={Boolean(lockedType) && lockedType !== r}
            className={cn(
              "rounded-[var(--nexo-radius-sm)] px-3 py-2 text-small capitalize transition-colors",
              role === r
                ? "bg-[var(--nexo-primary)] [color:var(--nexo-primary-fg)]"
                : "text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)]"
            )}
            onClick={() => setRole(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="text-label">
          {role === "artist" ? "Full name" : "Contact name"}
        </span>
        <Input
          required
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">
          {role === "artist" ? "Artist / stage name" : "Label name"}
        </span>
        <Input
          required
          name="displayName"
          value={stageOrLabel}
          onChange={(e) => setStageOrLabel(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">
          {role === "label" ? "Business email" : "Email"}
        </span>
        <Input
          type="email"
          required
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">Country</span>
        <Select
          required
          name="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Country"
        >
          <option value="">Select country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </label>

      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        showStrength
      />

      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <label className="flex items-start gap-2 text-small text-[var(--nexo-text-secondary)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          required
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/refund-policy" className="underline underline-offset-4">
            Refund Policy
          </Link>
          , and confirm I am registering as an {role === "artist" ? "artist" : "label"} (not staff).
        </span>
      </label>

      <Button type="submit" className="w-full rounded-full" disabled={loading || !configured}>
        {loading ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-center text-caption text-[var(--nexo-text-muted)]">
        Already have an account?{" "}
        <Link
          href={`/login${preserveBillingQuery(search)}`}
          className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
