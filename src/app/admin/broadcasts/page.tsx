import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  createAnnouncementAction,
  createEmailBroadcastAction,
  processEmailBroadcastBatchAction,
  setAnnouncementActiveAction,
} from "@/app/admin/operations/actions";

export const metadata: Metadata = {
  title: "Broadcasts",
  robots: { index: false, follow: false },
};

const AudienceOptions = () => (
  <>
    <option value="all">Everyone</option>
    <option value="artists">All artists</option>
    <option value="labels">All labels</option>
    <option value="paid_artists">Paid artists</option>
    <option value="free_artists">Free artists</option>
    <option value="paid_labels">Paid labels</option>
    <option value="free_labels">Free labels</option>
    <option value="specific_user">Specific user</option>
    <option value="country">Country</option>
  </>
);

export default async function BroadcastsPage() {
  await RequireAdminPermission("admin:notifications");
  const supabase = await createClient();
  const [{ data: announcements }, { data: emailBroadcasts }, { data: outbound }] = await Promise.all([
    supabase
      .from("admin_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("admin_email_broadcasts")
      .select("id,title,subject,audience,status,recipient_count,queued_at,completed_at,error,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("email_outbound_events")
      .select("related_entity_id,status")
      .eq("related_entity_type", "admin_email_broadcast")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const eventCounts = new Map<string, Record<string, number>>();
  for (const row of outbound ?? []) {
    if (!row.related_entity_id) continue;
    const counts = eventCounts.get(row.related_entity_id) ?? {};
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    eventCounts.set(row.related_entity_id, counts);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Broadcast & Announcement Center"
        description="Publish realtime dashboard notices or queue branded account email broadcasts to precise artist/label audiences."
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <details
          open
          className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
        >
          <summary className="cursor-pointer font-semibold">New dashboard announcement</summary>
          <form action={createAnnouncementAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="title" required placeholder="Announcement title" />
            <Select name="severity" defaultValue="info">
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
            <Select name="audience" defaultValue="all">
              <AudienceOptions />
            </Select>
            <Input name="target_user_id" placeholder="Specific user UUID (when used)" />
            <Input name="country_code" placeholder="Country value / code (when used)" />
            <Input name="ends_at" type="datetime-local" />
            <Textarea
              name="body"
              required
              placeholder="Announcement message"
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <Button type="submit">Publish dashboard announcement</Button>
            </div>
          </form>
        </details>

        <details
          open
          className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
        >
          <summary className="cursor-pointer font-semibold">New branded email broadcast</summary>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Recipients are resolved from current Nexo profiles, active suppressions are excluded, and delivery is queued through the canonical email outbox.
          </p>
          <form action={createEmailBroadcastAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="title" required placeholder="Internal broadcast title" />
            <Input name="subject" required placeholder="Email subject" />
            <Select name="audience" defaultValue="all">
              <AudienceOptions />
            </Select>
            <Input name="target_user_id" placeholder="Specific user UUID (when used)" />
            <Input name="country_code" placeholder="Country value / code (when used)" />
            <Textarea
              name="body"
              required
              placeholder="Plain-text message. Nexo branding is applied automatically."
              className="sm:col-span-2 min-h-40"
            />
            <div className="sm:col-span-2">
              <Button type="submit">Queue branded email broadcast</Button>
            </div>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-h4">Email broadcast queue</h2>
        {(emailBroadcasts ?? []).length === 0 ? (
          <p className="rounded border border-[var(--nexo-border)] p-4 text-small text-[var(--nexo-text-muted)]">
            No account email broadcasts yet.
          </p>
        ) : (
          (emailBroadcasts ?? []).map((row) => {
            const counts = eventCounts.get(row.id) ?? {};
            const pending = (counts.queued ?? 0) + (counts.pending ?? 0);
            const sent = counts.sent ?? 0;
            const failed = (counts.failed ?? 0) + (counts.skipped ?? 0);
            return (
              <article
                key={row.id}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                      {row.audience} · {row.status}
                    </p>
                    <h3 className="mt-1 font-semibold">{row.title}</h3>
                    <p className="mt-1 text-small">{row.subject}</p>
                    <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                      Recipients {row.recipient_count} · Sent {sent} · Pending {pending} · Failed/skipped {failed}
                    </p>
                    {row.error ? (
                      <p className="mt-2 text-caption text-red-600">{row.error}</p>
                    ) : null}
                  </div>
                  {pending > 0 ? (
                    <form action={processEmailBroadcastBatchAction}>
                      <input type="hidden" name="broadcast_id" value={row.id} />
                      <Button type="submit" size="sm">
                        Process next batch
                      </Button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-h4">Dashboard announcements</h2>
        {(announcements ?? []).map((row) => (
          <article
            key={row.id}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                  {row.audience} · {row.severity}
                </p>
                <h3 className="mt-1 font-semibold">{row.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-small text-[var(--nexo-text-secondary)]">
                  {row.body}
                </p>
                <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                  {new Date(row.starts_at).toLocaleString()}
                  {row.ends_at ? ` → ${new Date(row.ends_at).toLocaleString()}` : ""}
                </p>
              </div>
              <form action={setAnnouncementActiveAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="active" value={row.active ? "false" : "true"} />
                <Button size="sm" variant="outline" type="submit">
                  {row.active ? "Deactivate" : "Activate"}
                </Button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
