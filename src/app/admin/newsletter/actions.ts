"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sendNewsletterCampaign } from "@/lib/email/newsletter-send";
import { filterActiveSubscriberEmails } from "@/lib/newsletter/email";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";

export type CampaignActionResult =
  | { ok: true; campaignId: string; status: string; message: string }
  | { ok: false; error: string };

export async function createAndSendNewsletterCampaign(formData: FormData): Promise<CampaignActionResult> {
  const ctx = await RequireAdminPermission("admin:newsletter");
  const limited = checkRateLimit({
    key: `admin-newsletter:${ctx.userId}`,
    ...RATE_LIMITS.adminMutation,
  });
  if (!limited.ok) {
    return { ok: false, error: "Too many requests. Please wait and try again." };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim();
  if (subject.length < 1 || subject.length > 300) {
    return { ok: false, error: "Subject is required (max 300 characters)." };
  }
  if (bodyHtml.length < 1 || bodyHtml.length > 200000) {
    return { ok: false, error: "Body is required." };
  }

  // Minimal HTML escape for plain textarea → paragraphs (safe default)
  const safeBody = bodyHtml.includes("<")
    ? bodyHtml
    : `<p>${bodyHtml
        .split(/\n\n+/)
        .map((p) =>
          p
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>")
        )
        .join("</p><p>")}</p>`;

  const supabase = await createClient();
  const { data: campaign, error: cErr } = await supabase
    .from("newsletter_campaigns")
    .insert({
      subject,
      body_html: safeBody,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (cErr || !campaign) {
    return { ok: false, error: cErr?.message ?? "Could not create campaign." };
  }

  const { data: subs, error: sErr } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status, unsubscribe_token")
    .eq("status", "active");

  if (sErr) {
    return { ok: false, error: sErr.message };
  }

  const active = (subs ?? []).filter((s) => s.status === "active");
  // Defense: exclude unsubscribed even if query drifts
  const emails = filterActiveSubscriberEmails(active);
  const recipients = active
    .filter((s) => emails.includes(String(s.email).toLowerCase()))
    .map((s) => ({
      subscriberId: s.id as string,
      email: String(s.email).toLowerCase(),
      unsubscribeToken: String(s.unsubscribe_token),
    }));

  if (recipients.length === 0) {
    await supabase
      .from("newsletter_campaigns")
      .update({ status: "failed", error: "No active subscribers.", recipient_count: 0 })
      .eq("id", campaign.id);
    revalidatePath("/admin/newsletter");
    return { ok: false, error: "No active subscribers to send to." };
  }

  let result;
  try {
    result = await sendNewsletterCampaign({
      campaignId: campaign.id,
      subject,
      bodyHtml: safeBody,
      recipients,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    await supabase
      .from("newsletter_campaigns")
      .update({ status: "failed", error: msg, recipient_count: recipients.length })
      .eq("id", campaign.id);
    revalidatePath("/admin/newsletter");
    return { ok: false, error: msg };
  }

  revalidatePath("/admin/newsletter");

  if (!result.providerConnected) {
    return {
      ok: true,
      campaignId: campaign.id,
      status: result.campaignStatus,
      message:
        "Provider Not Connected — campaign queued as pending. Messages were not marked sent.",
    };
  }

  return {
    ok: true,
    campaignId: campaign.id,
    status: result.campaignStatus,
    message: `Send finished: ${result.sent} sent, ${result.queued} queued, ${result.failed} failed.`,
  };
}
