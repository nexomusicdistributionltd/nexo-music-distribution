"use client";

import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  OTP_RESEND_API_PATH,
  OTP_RESEND_COOLDOWN_MS,
  OTP_START_API_PATH,
  OTP_VERIFY_API_PATH,
} from "@/lib/auth/login-otp/constants";
import { hardRedirectToLogin, performClientLogout } from "@/lib/auth/logout-client";

type StartPayload = {
  ok?: boolean;
  error?: string;
  maskedEmail?: string;
  expiresAt?: string;
  resendAvailableAt?: string;
  alreadyVerified?: boolean;
  redirectTo?: string;
};

export function LoginOtpForm({
  initialFrom,
}: {
  initialFrom?: string | null;
}) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = React.useState<string>("your email");
  const [loading, setLoading] = React.useState(false);
  const [starting, setStarting] = React.useState(true);
  const [startFailed, setStartFailed] = React.useState(false);
  const [resendAt, setResendAt] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const applyStart = React.useCallback((json: StartPayload) => {
    if (json.alreadyVerified && json.redirectTo) {
      window.location.replace(json.redirectTo);
      return;
    }
    if (json.maskedEmail) setMaskedEmail(json.maskedEmail);
    if (json.resendAvailableAt) {
      const ts = Date.parse(json.resendAvailableAt);
      if (Number.isFinite(ts)) setResendAt(ts);
      else setResendAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
    } else {
      setResendAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      setStarting(true);
      try {
        const res = await fetch(OTP_START_API_PATH, {
          method: "POST",
          credentials: "same-origin",
        });
        const json = (await res.json()) as StartPayload;
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setStartFailed(true);
          setError(json.error ?? "We could not send a verification code.");
          return;
        }
        setStartFailed(false);
        applyStart(json);
      } catch {
        if (!cancelled) setError("We could not send a verification code.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyStart]);

  const waitSec = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch(OTP_VERIFY_API_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, from: initialFrom ?? undefined }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
        locked?: boolean;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That code is incorrect. Try again.");
        if (json.locked) {
          await performClientLogout();
          hardRedirectToLogin();
        }
        return;
      }
      window.location.replace(json.redirectTo || "/dashboard");
    } catch {
      setError("Could not verify the code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (waitSec > 0) return;
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(OTP_RESEND_API_PATH, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as StartPayload;
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Could not resend the code.");
        if (json.resendAvailableAt) applyStart(json);
        return;
      }
      setStartFailed(false);
      applyStart(json);
      setInfo("A new code was sent. Previous codes no longer work.");
    } catch {
      setError("Could not resend the code.");
    }
  }

  async function onCancel() {
    await performClientLogout();
    hardRedirectToLogin();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {starting ? (
        <p className="text-small text-[var(--nexo-text-muted)]">Sending your verification code…</p>
      ) : null}
      {info ? <Alert variant="success">{info}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {!starting && !startFailed ? (
        <Alert title="Check your email">
          We sent a 6-digit code to <strong>{maskedEmail}</strong>. It expires in 10 minutes.
          Enter it here to finish signing in.
        </Alert>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-label">Verification code</span>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          name="otp"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          aria-label="6-digit verification code"
          className="text-center font-mono tracking-[0.4em] text-h3"
          required
          disabled={starting || startFailed}
        />
      </label>

      <Button type="submit" className="w-full rounded-full" disabled={loading || startFailed || code.length !== 6}>
        {loading ? "Verifying…" : "Verify and continue"}
      </Button>

      <div className="flex flex-col gap-2 text-center text-caption text-[var(--nexo-text-muted)]">
        <button
          type="button"
          className="underline-offset-4 hover:text-[var(--nexo-text)] hover:underline disabled:no-underline disabled:opacity-60"
          onClick={onResend}
          disabled={waitSec > 0}
        >
          {waitSec > 0 ? `Resend code in ${waitSec}s` : "Resend code"}
        </button>
        <button
          type="button"
          className="underline-offset-4 hover:text-[var(--nexo-text)] hover:underline"
          onClick={onCancel}
        >
          Sign out and use a different account
        </button>
      </div>
    </form>
  );
}
