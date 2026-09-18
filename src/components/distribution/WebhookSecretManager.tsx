"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  rotateProviderWebhookSecretAction,
  saveProviderWebhookSecretAction,
  testProviderWebhookAction,
} from "@/app/admin/distribution/actions";

export function WebhookSecretManager({
  configured,
  source,
  initialSecret,
}: {
  configured: boolean;
  source: string;
  initialSecret?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [secretInput, setSecretInput] = React.useState("");
  const [revealedSecret, setRevealedSecret] = React.useState(initialSecret ?? "");
  const [message, setMessage] = React.useState(
    initialSecret
      ? "A new signing secret was created. Copy it now and configure the same secret in the provider webhook settings."
      : ""
  );
  const [error, setError] = React.useState("");

  function saveSecret() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveProviderWebhookSecretAction(secretInput);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSecretInput("");
      setRevealedSecret("");
      setMessage("Provider-issued signing secret saved securely.");
      router.refresh();
    });
  }

  function rotateSecret() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await rotateProviderWebhookSecretAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealedSecret(result.data.secret);
      setMessage(
        "Signing secret rotated. Update the provider webhook configuration with this new secret before live events are sent."
      );
      router.refresh();
    });
  }

  function sendTest() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await testProviderWebhookAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Signed test event received: ${result.data.eventId}`);
      router.refresh();
    });
  }

  async function copySecret() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setMessage("Signing secret copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the secret manually.");
    }
  }

  return (
    <section className="mt-5 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h4">Webhook receiver</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Status: <strong>{configured ? "Ready" : "Setup required"}</strong>
            {configured ? ` · secret source: ${source === "environment" ? "server environment" : "encrypted Nexo store"}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={sendTest}
          className="rounded-md border border-[var(--nexo-border)] px-3 py-2 text-small font-semibold hover:bg-[var(--nexo-ghost-hover)] disabled:opacity-50"
        >
          {pending ? "Working…" : "Send signed test event"}
        </button>
      </div>

      {revealedSecret ? (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-small font-semibold">Signing secret — copy it now</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={revealedSecret}
              className="min-w-0 flex-1 rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 font-mono text-xs"
              aria-label="Provider webhook signing secret"
            />
            <button
              type="button"
              onClick={copySecret}
              className="rounded-md bg-[var(--nexo-text)] px-3 py-2 text-small font-semibold [color:var(--nexo-text-inverse)]"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Keep this server-side. The provider must use the same signing secret for HMAC-SHA256 webhook delivery.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-caption font-medium">Provider-issued signing secret</span>
          <input
            type="password"
            autoComplete="off"
            value={secretInput}
            onChange={(event) => setSecretInput(event.target.value)}
            placeholder="Paste the webhook signing secret from the provider"
            className="mt-1 w-full rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small"
          />
        </label>
        <button
          type="button"
          disabled={pending || secretInput.trim().length < 16}
          onClick={saveSecret}
          className="self-end rounded-md bg-[var(--nexo-text)] px-4 py-2 text-small font-semibold [color:var(--nexo-text-inverse)] disabled:opacity-50"
        >
          Save signing secret
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={rotateSecret}
          className="rounded-md border border-[var(--nexo-border)] px-3 py-2 text-small font-semibold hover:bg-[var(--nexo-ghost-hover)] disabled:opacity-50"
        >
          Generate / rotate Nexo secret
        </button>
        <span className="text-caption text-[var(--nexo-text-muted)]">
          Rotate only when you can update the provider webhook configuration immediately.
        </span>
      </div>

      {message ? <p className="mt-3 text-small text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-3 text-small text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
