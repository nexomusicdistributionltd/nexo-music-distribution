import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  eventTypeForCatalogKey,
  templateKeyForReleaseTransition,
} from "./catalog";
import { canMarkOutboundSent } from "./status";
import type { TemplateKey } from "./types";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

/** Latest CREATE OR REPLACE body for a public function (plain $$ … $$;). */
function latestFunctionSql(name: string): string {
  const re = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$;`,
    "gi"
  );
  let latest = "";
  for (const file of migrationFiles()) {
    const src = readMigration(file);
    const matches = [...src.matchAll(re)];
    if (matches.length) latest = matches[matches.length - 1][0];
  }
  return latest;
}

const PROVIDER_SOURCES = new Set([
  "webhook",
  "sync_release_status",
  "apply_provider_sync_status",
]);

type OutboxRow = {
  templateKey: string;
  idempotencyKey: string;
  eventType: string;
};

type ReleaseSim = {
  id: string;
  status: string;
  providerConnected: boolean;
};

/** Mirrors enqueue_email_event unique on payload._idempotency_key. */
class Outbox {
  rows: OutboxRow[] = [];

  enqueue(row: OutboxRow): OutboxRow | null {
    if (this.rows.some((r) => r.idempotencyKey === row.idempotencyKey)) return null;
    this.rows.push(row);
    return row;
  }

  of(key: string): OutboxRow[] {
    return this.rows.filter((r) => r.templateKey === key);
  }
}

function catalogIdempotencyKey(releaseId: string, to: string, historyId: string | null): string {
  return `RELEASE_STATUS:${releaseId}:${to}:${historyId ?? "none"}`;
}

/**
 * Mirrors enqueue_release_catalog_email: one catalog key, stable history-based
 * idempotency, dormant LIVE/DELIVERED unless authoritative provider source.
 * SMTP/enqueue failure swallows (does not throw into the status update).
 */
function enqueueReleaseCatalogEmail(
  outbox: Outbox,
  opts: {
    release: ReleaseSim;
    from: string;
    to: string;
    historyId: string;
    metadata?: { source?: string };
    smtpFail?: boolean;
  }
): void {
  const key = templateKeyForReleaseTransition(opts.from, opts.to);
  if (!key) return;
  const source = opts.metadata?.source ?? "";
  const allowDormant =
    opts.release.providerConnected && PROVIDER_SOURCES.has(source);
  if ((key === "RELEASE_DELIVERED" || key === "RELEASE_LIVE") && !allowDormant) {
    return;
  }
  if (opts.smtpFail) return;
  outbox.enqueue({
    templateKey: key,
    eventType: eventTypeForCatalogKey(key),
    idempotencyKey: catalogIdempotencyKey(opts.release.id, opts.to, opts.historyId),
  });
}

/** Latest enqueue_distribution_email: no-op. */
function enqueueDistributionEmail(): null {
  return null;
}

function transitionReleaseStatus(
  outbox: Outbox,
  release: ReleaseSim,
  to: string,
  historyId: string,
  metadata?: { source?: string },
  smtpFail = false
): { status: string } {
  const from = release.status;
  release.status = to;
  enqueueReleaseCatalogEmail(outbox, {
    release,
    from,
    to,
    historyId,
    metadata,
    smtpFail,
  });
  enqueueDistributionEmail();
  return { status: release.status };
}

function leftoverBatch6Enqueue(templateKey: string): null {
  void templateKey;
  return enqueueDistributionEmail();
}

describe("SQL: canonical enqueue path (latest migrations)", () => {
  const catalogHooks = readMigration("20260915700006_release_catalog_email_hooks.sql");
  const noop = readMigration("20260915700007_enqueue_distribution_email_noop.sql");
  const recipientIntegrity = readMigration("20260918235950_transactional_email_recipient_integrity.sql");
  const enqueueSql = latestFunctionSql("enqueue_email_event");
  const transitionSql = latestFunctionSql("transition_release_status");
  const catalogSql = latestFunctionSql("enqueue_release_catalog_email");
  const distSql = latestFunctionSql("enqueue_distribution_email");

  it("transition_release_status enqueues catalog mail once, not distribution mail", () => {
    expect(transitionSql).toContain("perform public.enqueue_release_catalog_email(");
    expect(transitionSql).not.toMatch(/perform public\.enqueue_distribution_email\s*\(/);
    expect(catalogHooks).toMatch(/Must not fail the transition or invent SENT/);
  });

  it("enqueue_distribution_email is a no-op after 20260915700007", () => {
    expect(distSql).toBeTruthy();
    expect(distSql).toContain("return null");
    expect(distSql).not.toMatch(/enqueue_release_catalog_email\s*\(/);
    expect(distSql).not.toMatch(/enqueue_email_event\s*\(/);
    expect(distSql).not.toMatch(/insert into public\.email_outbound_events/);
    expect(noop).toMatch(/No-op/i);
  });

  it("catalog enqueue swallows errors so SMTP/outbox failure cannot roll back status", () => {
    expect(catalogSql).toMatch(/exception\s+when others then\s+return null/i);
    expect(distSql).toMatch(/exception\s+when others then\s+return null/i);
  });

  it("uses a single history-based idempotency key (not gen_random_uuid)", () => {
    expect(catalogSql).toContain("'RELEASE_STATUS:' || p_release_id::text || ':' || p_to::text || ':' || coalesce(p_history_id::text, 'none')");
    expect(distSql).not.toContain("gen_random_uuid()");
    expect(enqueueSql).toMatch(/when unique_violation then\s+return null/i);
    expect(readMigration("20260915700003_email_outbound_enqueue.sql")).toContain(
      "email_outbound_events_idempotency_uidx"
    );
  });

  it("keeps LIVE/DELIVERED dormant unless webhook/sync/apply_provider_sync_status", () => {
    expect(catalogSql).toContain("RELEASE_DELIVERED");
    expect(catalogSql).toContain("RELEASE_LIVE");
    expect(catalogSql).toContain("allow_dormant");
    expect(catalogSql).toContain("'webhook'");
    expect(catalogSql).toContain("'sync_release_status'");
    expect(catalogSql).toContain("'apply_provider_sync_status'");
  });


  it("pins transactional email to one canonical affected user", () => {
    expect(enqueueSql).toContain("join public.profiles p on p.id = r.owner_user_id");
    expect(enqueueSql).toContain("p_recipient_user_id <> resolved_user_id");
    expect(enqueueSql).toContain("Transactional email requires exactly one recipient address");
    expect(recipientIntegrity).toContain("Release lifecycle/QC email can never trust a caller-supplied address");
  });

  it("release approval payload and template contain exact release metadata", () => {
    for (const key of [
      "'RELEASE_ID'",
      "'RELEASE_TYPE'",
      "'ARTIST_NAME'",
      "'LABEL_NAME'",
      "'UPC'",
      "'RELEASE_DATE'",
      "'ORIGINAL_RELEASE_DATE'",
      "'GENRE'",
      "'LANGUAGE'",
      "'TERRITORIES'",
      "'COPYRIGHT_LINE'",
      "'PHONOGRAM_LINE'",
      "'TRACK_COUNT'",
      "'TRACKS_SUMMARY'",
      "'REASON'",
    ]) {
      expect(catalogSql).toContain(key);
    }
    const approved = readFileSync(join(ROOT, "emails/templates/RELEASE_APPROVED.html"), "utf8");
    expect(approved).toContain("{{RELEASE_ID}}");
    expect(approved).toContain("{{TRACKS_SUMMARY}}");
    expect(approved).toContain("{{DECISION_SUMMARY}}");
  });
});

describe("one transition → one outbox row (catalog path + leftover no-op)", () => {
  it("1. one approval → exactly one RELEASE_APPROVED", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    transitionReleaseStatus(outbox, release, "approved", "hist-approve");
    leftoverBatch6Enqueue("release_status_approved");
    expect(outbox.of("RELEASE_APPROVED")).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
    expect(release.status).toBe("approved");
  });

  it("2. retried RPC with the same history id → no duplicate", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    transitionReleaseStatus(outbox, release, "approved", "hist-approve");
    enqueueReleaseCatalogEmail(outbox, {
      release,
      from: "in_qc",
      to: "approved",
      historyId: "hist-approve",
    });
    leftoverBatch6Enqueue("release_status_approved");
    expect(outbox.of("RELEASE_APPROVED")).toHaveLength(1);
  });

  it("3. refresh / realtime reconnect does not enqueue another email", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    transitionReleaseStatus(outbox, release, "approved", "hist-approve");
    const realtime = readFileSync(
      join(ROOT, "src/components/notifications/RealtimeRefresh.tsx"),
      "utf8"
    );
    expect(realtime).toContain("router.refresh()");
    expect(realtime).not.toMatch(/enqueue/i);
    expect(outbox.of("RELEASE_APPROVED")).toHaveLength(1);
  });

  it("4. changes requested → one RELEASE_CHANGES_REQUIRED", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    transitionReleaseStatus(outbox, release, "changes_requested", "hist-cr");
    leftoverBatch6Enqueue("release_status_changes_requested");
    expect(outbox.of("RELEASE_CHANGES_REQUIRED")).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
  });

  it("5. rejected → one RELEASE_REJECTED", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    transitionReleaseStatus(outbox, release, "rejected", "hist-rej");
    leftoverBatch6Enqueue("release_status_rejected");
    expect(outbox.of("RELEASE_REJECTED")).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
  });

  it("6. scheduled → one RELEASE_QUEUED (leftover Batch 6 key cannot add RELEASE_APPROVED)", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "approved", providerConnected: false };
    transitionReleaseStatus(outbox, release, "scheduled", "hist-sched", {
      source: "queue_approved_release",
    });
    leftoverBatch6Enqueue("release_queued_for_distribution");
    expect(outbox.of("RELEASE_QUEUED")).toHaveLength(1);
    expect(outbox.of("RELEASE_APPROVED")).toHaveLength(0);
    expect(outbox.rows).toHaveLength(1);
  });

  it("7. delivery failure → one RELEASE_FAILED", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "delivering", providerConnected: true };
    transitionReleaseStatus(outbox, release, "failed", "hist-fail", {
      source: "complete_submit_queued_release",
    });
    leftoverBatch6Enqueue("release_distribution_failed");
    expect(outbox.of("RELEASE_FAILED")).toHaveLength(1);
    expect(outbox.of("RELEASE_APPROVED")).toHaveLength(0);
    expect(outbox.rows).toHaveLength(1);
  });

  it("8. delivered/live dormant unless authoritative provider state", () => {
    const dormant = new Outbox();
    const relA: ReleaseSim = { id: "rel-1", status: "delivering", providerConnected: false };
    transitionReleaseStatus(dormant, relA, "delivered", "hist-d1", { source: "queue_approved_release" });
    leftoverBatch6Enqueue("release_delivered");
    expect(dormant.of("RELEASE_DELIVERED")).toHaveLength(0);

    const liveNoProvider = new Outbox();
    const relB: ReleaseSim = { id: "rel-1", status: "delivered", providerConnected: true };
    transitionReleaseStatus(liveNoProvider, relB, "live", "hist-l1", { source: "complete_submit_queued_release" });
    expect(liveNoProvider.of("RELEASE_LIVE")).toHaveLength(0);

    const liveOk = new Outbox();
    const relC: ReleaseSim = { id: "rel-1", status: "delivered", providerConnected: true };
    transitionReleaseStatus(liveOk, relC, "live", "hist-l2", { source: "webhook" });
    leftoverBatch6Enqueue("release_live");
    expect(liveOk.of("RELEASE_LIVE")).toHaveLength(1);
    expect(liveOk.rows).toHaveLength(1);
  });

  it("9. SMTP failure does not change release state", () => {
    const outbox = new Outbox();
    const release: ReleaseSim = { id: "rel-1", status: "in_qc", providerConnected: false };
    const after = transitionReleaseStatus(outbox, release, "approved", "hist-smtp", undefined, true);
    expect(after.status).toBe("approved");
    expect(release.status).toBe("approved");
    expect(outbox.rows).toHaveLength(0);
    expect(canMarkOutboundSent("zoho-smtp", "")).toBe(false);
    expect(canMarkOutboundSent("resend", "msg_1")).toBe(false);
  });

  it("10. unrelated support/account emails still use enqueue_email_event, not the no-op", () => {
    const outbox = new Outbox();
    outbox.enqueue({
      templateKey: "SUPPORT_TICKET_CREATED" satisfies TemplateKey | string,
      eventType: "support",
      idempotencyKey: "SUPPORT_TICKET_CREATED:t1",
    });
    outbox.enqueue({
      templateKey: "ACCOUNT_SUSPENDED",
      eventType: "account.status",
      idempotencyKey: "ACCOUNT:ACCOUNT_SUSPENDED:u1:suspended:none:1",
    });
    leftoverBatch6Enqueue("release_queued_for_distribution");
    expect(outbox.of("SUPPORT_TICKET_CREATED")).toHaveLength(1);
    expect(outbox.of("ACCOUNT_SUSPENDED")).toHaveLength(1);

    const support = readFileSync(join(ROOT, "src/app/(portal)/support/actions.ts"), "utf8");
    const admin = readFileSync(join(ROOT, "src/app/admin/actions.ts"), "utf8");
    expect(support).toContain("enqueueTransactionalEmail");
    expect(support).toContain("SUPPORT_TICKET_CREATED");
    expect(admin).toContain("ACCOUNT_SUSPENDED");
    expect(support).not.toContain("enqueue_distribution_email");
    expect(admin).not.toContain("enqueue_distribution_email");
  });
});

describe("QC mapping still one catalog key per decision", () => {
  it("does not invent LIVE from approved", () => {
    expect(templateKeyForReleaseTransition("in_qc", "approved")).toBe("RELEASE_APPROVED");
    expect(templateKeyForReleaseTransition("approved", "scheduled")).toBe("RELEASE_QUEUED");
    expect(templateKeyForReleaseTransition("delivering", "failed")).toBe("RELEASE_FAILED");
    expect(templateKeyForReleaseTransition("approved", "changes_requested")).toBe(
      "RELEASE_UPDATE_REQUIRED"
    );
  });
});
