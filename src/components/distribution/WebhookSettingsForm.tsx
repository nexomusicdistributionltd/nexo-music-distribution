"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import {
  clearProviderWebhookSecretAction,
  saveProviderWebhookSettingsAction,
} from "@/app/admin/distribution/webhooks/actions";

export function WebhookSettingsForm({
  configured,
  enabled,
  signatureHeader,
  source,
}: {
  configured: boolean;
  enabled: boolean;
  signatureHeader: string;
  source: "environment" | "database" | "none";
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Webhook signing</h2>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Configure only the signing secret and header issued for Nexo by the Distribution Engine.
          The secret is encrypted at rest and never displayed again.
        </p>
      </div>

      <Alert variant={configured ? "success" : "warning"} title={configured ? "Signing verification configured" : "Provider signing secret required"}>
        {configured
          ? `Inbound webhook verification is enabled from ${source === "environment" ? "server environment" : "encrypted Nexo settings"}.`
          : "Inbound provider events remain fail-closed until the provider-issued signing secret is saved."}
      </Alert>

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await saveProviderWebhookSettingsAction({
              secret: String(fd.get("secret") || ""),
              signatureHeader: String(fd.get("signature_header") || "x-provider-signature"),
              enabled: fd.get("enabled") === "on",
            });
            setMessage({ ok: result.ok, text: result.ok ? "Webhook settings saved." : result.error });
            if (result.ok) {
              event.currentTarget.reset();
              router.refresh();
            }
          });
        }}
      >
        <Input
          type="password"
          name="secret"
          autoComplete="new-password"
          placeholder={configured ? "Leave blank to keep current signing secret" : "Provider-issued signing secret"}
          disabled={source === "environment"}
        />
        <Input
          name="signature_header"
          defaultValue={signatureHeader}
          placeholder="x-provider-signature"
          disabled={source === "environment"}
        />
        <label className="flex items-center gap-2 text-small">
          <input name="enabled" type="checkbox" defaultChecked={enabled} disabled={source === "environment"} />
          Accept signed provider webhook events
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={pending || source === "environment"}>
            {pending ? "Saving…" : configured ? "Update signing settings" : "Save signing settings"}
          </Button>
          {source === "database" ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await clearProviderWebhookSecretAction();
                  setMessage({ ok: result.ok, text: result.ok ? "Stored signing secret removed." : result.error });
                  if (result.ok) router.refresh();
                })
              }
            >
              Remove stored secret
            </Button>
          ) : null}
        </div>
      </form>

      {message ? <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert> : null}
    </section>
  );
}
