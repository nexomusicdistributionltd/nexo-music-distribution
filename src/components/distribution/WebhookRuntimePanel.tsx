"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  revealProviderWebhookSecretAction,
  rotateProviderWebhookSecretAction,
  testProviderWebhookSignatureAction,
} from "@/app/admin/distribution/actions";

export function WebhookRuntimePanel({
  endpoint,
  configured,
  source,
  canManageSecret,
}: {
  endpoint: string;
  configured: boolean;
  source: "environment" | "database" | "none";
  canManageSecret: boolean;
}) {
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reveal() {
    start(async () => {
      const result = await revealProviderWebhookSecretAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSecret(result.data.secret);
      setMessage(
        "Signing secret revealed for this administrator. Register this exact secret with the provider webhook configuration."
      );
    });
  }

  function rotate() {
    start(async () => {
      const result = await rotateProviderWebhookSecretAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSecret(result.data.secret);
      setMessage(
        "Signing secret rotated. Update the provider webhook configuration before the next event is sent."
      );
    });
  }

  function testSignature() {
    start(async () => {
      const result = await testProviderWebhookSignatureAction();
      setMessage(result.ok ? result.data.message : result.error);
    });
  }

  return (
    <section className="mt-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h4">Webhook runtime</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Secure inbound Distribution Engine event ingestion.
          </p>
        </div>
        <span className="rounded-full border border-[var(--nexo-border)] px-2.5 py-1 text-caption">
          {configured ? "Signing configured" : "Setup required"}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2">
        <div>
          <dt className="text-[var(--nexo-text-muted)]">Endpoint</dt>
          <dd className="mt-1 break-all font-mono text-caption">{endpoint}</dd>
        </div>
        <div>
          <dt className="text-[var(--nexo-text-muted)]">Secret source</dt>
          <dd className="mt-1">{source === "none" ? "Not provisioned" : source}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {canManageSecret ? (
          <>
            <Button size="sm" disabled={pending || !configured} onClick={reveal}>
              Reveal signing secret
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !configured || source === "environment"}
              onClick={rotate}
            >
              Rotate secret
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !configured}
          onClick={testSignature}
        >
          Test signature
        </Button>
      </div>

      {secret ? (
        <div className="mt-4 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] p-3">
          <p className="text-caption text-[var(--nexo-text-muted)]">Webhook signing secret</p>
          <code className="mt-1 block break-all text-small">{secret}</code>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">{message}</p>
      ) : null}
    </section>
  );
}
