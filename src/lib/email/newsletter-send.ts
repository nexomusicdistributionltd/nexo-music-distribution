import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

/**
 * Minimal newsletter sender for this branch.
 * - Logs to email_outbound_events with template_key `newsletter_campaign`
 *   (payload kept generic so branded NexoBot templates can attach later).
 * - Marks status `sent` ONLY when a real provider returns a message id
 *   (protect_email_outbound_sent requires provider + provider_message_id).
 * - If provider not configured: queue as pending/queued, campaign → unavailable.
 * NEVER claim delivered without a real send.
 */

export type NewsletterSendResult = {
  providerConnected: boolean;
  providerName: string | null;
  sent: number;
  queued: number;
  failed: number;
  campaignStatus: "sent" | "queued" | "unavailable" | "failed";
  error?: string;
};

export type NewsletterRecipient = {
  subscriberId: string;
  email: string;
  unsubscribeToken: string;
};

export function isEmailProviderConfigured(): boolean {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "resend" && (process.env.RESEND_API_KEY ?? "").trim()) return true;
  if ((process.env.RESEND_API_KEY ?? "").trim() && (!provider || provider === "resend")) {
    return true;
  }
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASSWORD ?? "").trim();
  if (host && user && pass) return true;
  return false;
}

export function resolveEmailProviderName(): string | null {
  if (!isEmailProviderConfigured()) return null;
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "resend" || (process.env.RESEND_API_KEY ?? "").trim()) return "resend";
  if ((process.env.SMTP_HOST ?? "").trim()) return provider || "smtp";
  return null;
}

export function buildNewsletterHtml(opts: {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
}): string {
  const site = getSiteUrl();
  // Simple branded wrapper — template_key hooks allow richer catalog later.
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#a3a3a3;">NEXO Music Distribution</p>
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#fafafa;">${escapeHtml(opts.subject)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#e5e5e5;">${opts.bodyHtml}</div>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;"/>
          <p style="margin:0;font-size:12px;color:#737373;">
            You’re receiving this because you subscribed at
            <a href="${site}" style="color:#a3a3a3;">nexomusicdistribution.com</a>.
            <a href="${opts.unsubscribeUrl}" style="color:#a3a3a3;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) {
    return { ok: false, error: data.message || `Resend HTTP ${res.status}` };
  }
  return { ok: true, messageId: data.id };
}

/**
 * Send (or queue) a campaign to active recipients in safe chunks.
 * Caller must already have created the campaign row and selected active subscribers.
 */
export async function sendNewsletterCampaign(opts: {
  campaignId: string;
  subject: string;
  bodyHtml: string;
  recipients: NewsletterRecipient[];
  chunkSize?: number;
}): Promise<NewsletterSendResult> {
  const service = createServiceClient();
  const providerConnected = isEmailProviderConfigured();
  const providerName = resolveEmailProviderName();
  const from =
    (process.env.EMAIL_FROM ?? "").trim() || "NEXO Music Distribution <noreply@nexomusicdistribution.com>";
  const chunkSize = Math.max(1, Math.min(opts.chunkSize ?? 25, 50));

  let sent = 0;
  let queued = 0;
  let failed = 0;

  if (!providerConnected) {
    // Queue outbound rows as pending — never mark sent.
    for (let i = 0; i < opts.recipients.length; i += chunkSize) {
      const chunk = opts.recipients.slice(i, i + chunkSize);
      for (const r of chunk) {
        const unsub = absoluteUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}`);
        const html = buildNewsletterHtml({
          subject: opts.subject,
          bodyHtml: opts.bodyHtml,
          unsubscribeUrl: unsub,
        });
        const { data: ev, error } = await service
          .from("email_outbound_events")
          .insert({
            to_email: r.email,
            template_key: "newsletter_campaign",
            payload: {
              campaign_id: opts.campaignId,
              subscriber_id: r.subscriberId,
              subject: opts.subject,
              // Hook for future branded template catalog (NexoBot / admin templates)
              template_catalog_key: null,
              html,
            },
            status: "pending",
            related_entity_type: "newsletter_campaign",
            related_entity_id: opts.campaignId,
          })
          .select("id")
          .single();

        if (error || !ev) {
          failed += 1;
          await service.from("newsletter_campaign_recipients").insert({
            campaign_id: opts.campaignId,
            subscriber_id: r.subscriberId,
            email: r.email,
            status: "failed",
            error: error?.message ?? "queue insert failed",
          });
          continue;
        }

        queued += 1;
        await service.from("newsletter_campaign_recipients").insert({
          campaign_id: opts.campaignId,
          subscriber_id: r.subscriberId,
          email: r.email,
          status: "queued",
          outbound_event_id: ev.id,
        });
      }
    }

    await service
      .from("newsletter_campaigns")
      .update({
        status: "unavailable",
        recipient_count: opts.recipients.length,
        error: "Email provider not connected — messages queued as pending only.",
      })
      .eq("id", opts.campaignId);

    return {
      providerConnected: false,
      providerName: null,
      sent: 0,
      queued,
      failed,
      campaignStatus: "unavailable",
      error: "Provider Not Connected",
    };
  }

  // Real provider path
  await service
    .from("newsletter_campaigns")
    .update({ status: "sending", recipient_count: opts.recipients.length })
    .eq("id", opts.campaignId);

  for (let i = 0; i < opts.recipients.length; i += chunkSize) {
    const chunk = opts.recipients.slice(i, i + chunkSize);
    for (const r of chunk) {
      const unsub = absoluteUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}`);
      const html = buildNewsletterHtml({
        subject: opts.subject,
        bodyHtml: opts.bodyHtml,
        unsubscribeUrl: unsub,
      });

      // Insert as pending first (protect trigger blocks fake sent)
      const { data: ev, error: insertErr } = await service
        .from("email_outbound_events")
        .insert({
          to_email: r.email,
          template_key: "newsletter_campaign",
          payload: {
            campaign_id: opts.campaignId,
            subscriber_id: r.subscriberId,
            subject: opts.subject,
            template_catalog_key: null,
          },
          status: "pending",
          related_entity_type: "newsletter_campaign",
          related_entity_id: opts.campaignId,
        })
        .select("id")
        .single();

      if (insertErr || !ev) {
        failed += 1;
        await service.from("newsletter_campaign_recipients").insert({
          campaign_id: opts.campaignId,
          subscriber_id: r.subscriberId,
          email: r.email,
          status: "failed",
          error: insertErr?.message ?? "outbound insert failed",
        });
        continue;
      }

      let sendResult: { ok: true; messageId: string } | { ok: false; error: string };
      if ((process.env.RESEND_API_KEY ?? "").trim()) {
        sendResult = await sendViaResend({
          to: r.email,
          subject: opts.subject,
          html,
          from,
        });
      } else {
        // SMTP configured but no Resend: keep pending/queued — do not fake sent.
        // (nodemailer not in package.json; leave hook for ops / future transport.)
        await service
          .from("email_outbound_events")
          .update({
            status: "queued",
            provider: providerName,
            error: "SMTP configured; awaiting transport worker. Not marked sent.",
            payload: {
              campaign_id: opts.campaignId,
              subscriber_id: r.subscriberId,
              subject: opts.subject,
              template_catalog_key: null,
              html,
            },
          })
          .eq("id", ev.id);
        queued += 1;
        await service.from("newsletter_campaign_recipients").insert({
          campaign_id: opts.campaignId,
          subscriber_id: r.subscriberId,
          email: r.email,
          status: "queued",
          outbound_event_id: ev.id,
        });
        continue;
      }

      if (sendResult.ok) {
        // Mark sent only with real provider + message id (trigger-enforced)
        const { error: updErr } = await service
          .from("email_outbound_events")
          .update({
            status: "sent",
            provider: providerName,
            provider_message_id: sendResult.messageId,
          })
          .eq("id", ev.id);

        if (updErr) {
          failed += 1;
          await service.from("newsletter_campaign_recipients").insert({
            campaign_id: opts.campaignId,
            subscriber_id: r.subscriberId,
            email: r.email,
            status: "failed",
            outbound_event_id: ev.id,
            error: updErr.message,
          });
        } else {
          sent += 1;
          await service.from("newsletter_campaign_recipients").insert({
            campaign_id: opts.campaignId,
            subscriber_id: r.subscriberId,
            email: r.email,
            status: "sent",
            outbound_event_id: ev.id,
          });
        }
      } else {
        await service
          .from("email_outbound_events")
          .update({ status: "failed", error: sendResult.error, provider: providerName })
          .eq("id", ev.id);
        failed += 1;
        await service.from("newsletter_campaign_recipients").insert({
          campaign_id: opts.campaignId,
          subscriber_id: r.subscriberId,
          email: r.email,
          status: "failed",
          outbound_event_id: ev.id,
          error: sendResult.error,
        });
      }
    }
  }

  const campaignStatus: NewsletterSendResult["campaignStatus"] =
    failed > 0 && sent === 0 ? "failed" : sent > 0 ? "sent" : "queued";

  await service
    .from("newsletter_campaigns")
    .update({
      status: campaignStatus,
      recipient_count: opts.recipients.length,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      error: failed > 0 ? `${failed} recipient(s) failed` : null,
    })
    .eq("id", opts.campaignId);

  return {
    providerConnected: true,
    providerName,
    sent,
    queued,
    failed,
    campaignStatus,
  };
}
