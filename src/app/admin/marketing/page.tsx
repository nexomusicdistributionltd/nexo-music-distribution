import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { MARKETING_SERVICE_SPECS, marketingServiceSpec } from "@/lib/marketing/services";
import {
  updateMarketingContentAction,
  updateMarketingControlAction,
  updateMarketingRequestAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Marketing operations",
  robots: { index: false, follow: false },
};

const ACTIVE_STATUSES = new Set([
  "submitted",
  "reviewing",
  "needs_info",
  "accepted",
  "approved",
  "processing",
  "live",
]);

const STATUS_OPTIONS = [
  "submitted",
  "reviewing",
  "needs_info",
  "accepted",
  "approved",
  "processing",
  "live",
  "completed",
  "rejected",
  "cancelled",
] as const;

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;

type ContentSection = { heading: string; body: string };

function sectionsFrom(value: unknown): ContentSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const heading = typeof row.heading === "string" ? row.heading : "";
      const body = typeof row.body === "string" ? row.body : "";
      return heading && body ? { heading, body } : null;
    })
    .filter((item): item is ContentSection => Boolean(item));
}

function providerModeLabel(mode: string): string {
  if (mode === "toolost_api") return "TooLost API";
  if (mode === "toolost_manual") return "TooLost workflow";
  return "Nexo managed";
}

export default async function AdminMarketingPage() {
  const ctx = await RequireAdministrator();
  const supabase = await createClient();
  const kinds = MARKETING_SERVICE_SPECS.map((service) => service.kind);

  const [
    { data: controls, error: controlsError },
    { data: requests, error: requestsError },
    { data: contentPages, error: contentError },
  ] = await Promise.all([
    supabase
      .from("marketing_service_controls")
      .select("kind, label, enabled, accepting_requests, requires_release, provider_mode, provider_feature, description, admin_instructions, updated_at")
      .in("kind", kinds)
      .order("label"),
    supabase
      .from("portal_service_requests")
      .select("id, owner_user_id, kind, title, body, related_url, release_id, status, priority, admin_note, provider_state, provider_reference, provider_url, created_at, updated_at")
      .in("kind", kinds)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("marketing_content_pages")
      .select("slug, title, summary, sections, enabled, updated_at")
      .in("slug", ["client-offerings", "marketing-best-practices"])
      .order("slug"),
  ]);

  const userIds = [...new Set((requests ?? []).map((row) => row.owner_user_id).filter(Boolean))];
  const releaseIds = [...new Set((requests ?? []).map((row) => row.release_id).filter(Boolean))];

  const [{ data: profiles }, { data: releases }] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id, email, full_name, display_name")
          .in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; full_name: string | null; display_name: string | null }> }),
    releaseIds.length
      ? supabase.from("releases").select("id, title").in("id", releaseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string | null }> }),
  ]);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const releaseById = new Map((releases ?? []).map((row) => [row.id, row]));
  const controlByKind = new Map((controls ?? []).map((row) => [row.kind, row]));
  const activeCount = (requests ?? []).filter((row) => ACTIVE_STATUSES.has(row.status)).length;
  const needsInfoCount = (requests ?? []).filter((row) => row.status === "needs_info").length;

  return (
    <div className="space-y-8">
      <RealtimeRefresh userId={ctx.userId} staff />
      <PageHeader
        title="Marketing operations"
        description="Control artist/label marketing services, work real requests, and publish marketing guidance in real time. Provider fields must reflect actual upstream activity only."
      />

      {controlsError || requestsError || contentError ? (
        <Alert variant="warning" title="Marketing database migration required">
          One or more realtime marketing tables are unavailable. Apply the latest Supabase migration before operating this screen.
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active requests" value={String(activeCount)} />
        <Metric label="Needs information" value={String(needsInfoCount)} />
        <Metric label="Services accepting requests" value={String((controls ?? []).filter((row) => row.enabled && row.accepting_requests).length)} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h3">Service controls</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            These switches and descriptions feed the artist/label Marketing pages immediately through Supabase Realtime.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {MARKETING_SERVICE_SPECS.map((spec) => {
            const control = controlByKind.get(spec.kind);
            return (
              <form
                key={spec.kind}
                action={updateMarketingControlAction}
                className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
              >
                <input type="hidden" name="kind" value={spec.kind} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-h4">{control?.label || spec.label}</h3>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {providerModeLabel(control?.provider_mode || spec.providerMode)}
                      {control?.provider_feature || spec.providerFeature
                        ? " · feature: " + (control?.provider_feature || spec.providerFeature)
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-caption">
                    {control?.enabled === false ? "Disabled" : control?.accepting_requests === false ? "Paused" : "Live"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Service enabled">
                    <Select name="enabled" defaultValue={String(control?.enabled ?? true)}>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </Select>
                  </Field>
                  <Field label="Accept requests">
                    <Select name="accepting_requests" defaultValue={String(control?.accepting_requests ?? true)}>
                      <option value="true">Accepting</option>
                      <option value="false">Paused</option>
                    </Select>
                  </Field>
                  <Field label="Release required">
                    <Select name="requires_release" defaultValue={String(control?.requires_release ?? spec.requiresRelease)}>
                      <option value="true">Required</option>
                      <option value="false">Optional</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Artist/label description">
                  <Textarea
                    name="description"
                    defaultValue={control?.description || spec.guidance}
                    maxLength={1000}
                  />
                </Field>
                <Field label="Internal operations instructions">
                  <Textarea
                    name="admin_instructions"
                    defaultValue={control?.admin_instructions || spec.adminGuidance}
                    maxLength={4000}
                  />
                </Field>
                <Button type="submit" size="sm">Save service control</Button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h3">Dedicated marketing queues</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Playlist pitching already has its own live review queue and remains separate from generic marketing requests.
          </p>
        </div>
        <Link
          href="/admin/playlist-pitches"
          className="inline-flex rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-2 text-small font-medium hover:bg-[var(--nexo-surface)]"
        >
          Open Playlist Pitching queue
        </Link>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h3">Marketing requests</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Update Nexo status immediately. Enter provider state/reference only after the corresponding real TooLost or external action exists.
          </p>
        </div>

        {(requests ?? []).length === 0 ? (
          <EmptyState title="No marketing requests" />
        ) : (
          <div className="space-y-4">
            {(requests ?? []).map((request) => {
              const profile = profileById.get(request.owner_user_id);
              const release = request.release_id ? releaseById.get(request.release_id) : null;
              const spec = marketingServiceSpec(request.kind);
              return (
                <form
                  key={request.id}
                  action={updateMarketingRequestAction}
                  className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
                >
                  <input type="hidden" name="request_id" value={request.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-caption font-medium uppercase tracking-wide text-[var(--nexo-text-muted)]">
                        {spec?.label || request.kind}
                      </p>
                      <h3 className="mt-1 text-h4">{request.title}</h3>
                      <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                        {profile?.display_name || profile?.full_name || profile?.email || request.owner_user_id}
                        {release ? " · " + (release.title || "Untitled release") : ""}
                        {" · submitted " + new Date(request.created_at).toLocaleString("en", { timeZone: "UTC" }) + " UTC"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-caption uppercase tracking-wide">
                      {request.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {request.body ? <p className="text-small">{request.body}</p> : null}
                  {request.related_url ? (
                    <Link href={request.related_url} target="_blank" rel="noreferrer" className="text-caption underline underline-offset-4">
                      Open submitted reference
                    </Link>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nexo status">
                      <Select name="status" defaultValue={request.status}>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Priority">
                      <Select name="priority" defaultValue={request.priority || "normal"}>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Nexo operations note">
                    <Textarea name="admin_note" defaultValue={request.admin_note || ""} maxLength={4000} />
                  </Field>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <Field label="Real provider / external state">
                      <Input
                        name="provider_state"
                        defaultValue={request.provider_state || ""}
                        placeholder="e.g. submitted, eligible, enrolled"
                        maxLength={160}
                      />
                    </Field>
                    <Field label="Real provider reference">
                      <Input
                        name="provider_reference"
                        defaultValue={request.provider_reference || ""}
                        placeholder="Provider request/campaign ID"
                        maxLength={500}
                      />
                    </Field>
                    <Field label="Verified provider URL">
                      <Input
                        name="provider_url"
                        defaultValue={request.provider_url || ""}
                        placeholder="https://..."
                        maxLength={2000}
                      />
                    </Field>
                  </div>

                  {request.provider_url ? (
                    <Link href={request.provider_url} target="_blank" rel="noreferrer" className="text-caption underline underline-offset-4">
                      Open current provider reference
                    </Link>
                  ) : null}

                  <Button type="submit" size="sm">Save realtime status</Button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h3">Client Offerings & Best Practices</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Edit these artist/label knowledge pages here; saved content refreshes connected dashboards in real time.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {(contentPages ?? []).map((page) => {
            const sections = sectionsFrom(page.sections);
            return (
              <form
                key={page.slug}
                action={updateMarketingContentAction}
                className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
              >
                <input type="hidden" name="slug" value={page.slug} />
                <Field label="Published">
                  <Select name="enabled" defaultValue={String(page.enabled)}>
                    <option value="true">Published</option>
                    <option value="false">Hidden / paused</option>
                  </Select>
                </Field>
                <Field label="Title">
                  <Input name="title" defaultValue={page.title} required maxLength={200} />
                </Field>
                <Field label="Summary">
                  <Textarea name="summary" defaultValue={page.summary} required maxLength={1000} />
                </Field>
                {[...sections, { heading: "", body: "" }].map((section, index) => (
                  <div key={index} className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3">
                    <Input
                      name="section_heading"
                      defaultValue={section.heading}
                      placeholder={"Section " + (index + 1) + " heading"}
                      maxLength={200}
                    />
                    <Textarea
                      name="section_body"
                      defaultValue={section.body}
                      placeholder={"Section " + (index + 1) + " content"}
                      maxLength={5000}
                    />
                  </div>
                ))}
                <Button type="submit" size="sm">Publish content</Button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-caption font-medium text-[var(--nexo-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-1 text-h3 tabular-nums">{value}</p>
    </div>
  );
}
