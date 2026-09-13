import {
  APPROVED_TEMPLATE_KEYS,
  type EmailCatalogEntry,
  type TemplateKey,
} from "./types";

/**
 * Event type → template key → file path → subject.
 * Auth templates are managed by Supabase (Go templates); operational use Go-less {{VAR}} placeholders.
 */
export const EMAIL_CATALOG: EmailCatalogEntry[] = [
  // Auth (filePath null — supabase/templates/*.html)
  { eventType: "auth", templateKey: "AUTH_CONFIRMATION", filePath: null, subject: "Confirm your email — Nexo Music Distribution LTD" },
  { eventType: "auth", templateKey: "AUTH_INVITE", filePath: null, subject: "You're invited — Nexo Music Distribution LTD" },
  { eventType: "auth", templateKey: "AUTH_MAGIC_LINK", filePath: null, subject: "Your magic link — Nexo Music Distribution LTD" },
  { eventType: "auth", templateKey: "AUTH_RECOVERY", filePath: null, subject: "Reset your password — Nexo Music Distribution LTD" },
  { eventType: "auth", templateKey: "AUTH_EMAIL_CHANGE", filePath: null, subject: "Confirm email change — Nexo Music Distribution LTD" },
  { eventType: "auth", templateKey: "AUTH_REAUTHENTICATION", filePath: null, subject: "Confirm it's you — Nexo Music Distribution LTD" },

  { eventType: "release.submit", templateKey: "RELEASE_SUBMITTED", filePath: "emails/templates/RELEASE_SUBMITTED.html", subject: "Release submitted to Nexo" },
  { eventType: "release.status", templateKey: "RELEASE_UNDER_REVIEW", filePath: "emails/templates/RELEASE_UNDER_REVIEW.html", subject: "Release entered QC review" },
  { eventType: "release.qc", templateKey: "RELEASE_CHANGES_REQUIRED", filePath: "emails/templates/RELEASE_CHANGES_REQUIRED.html", subject: "Changes required on your release" },
  { eventType: "release.qc", templateKey: "RELEASE_REJECTED", filePath: "emails/templates/RELEASE_REJECTED.html", subject: "Release rejected" },
  { eventType: "release.qc", templateKey: "RELEASE_APPROVED", filePath: "emails/templates/RELEASE_APPROVED.html", subject: "Release approved" },
  { eventType: "release.status", templateKey: "RELEASE_QUEUED", filePath: "emails/templates/RELEASE_QUEUED.html", subject: "Release queued for distribution" },
  { eventType: "release.status", templateKey: "RELEASE_DISTRIBUTING", filePath: "emails/templates/RELEASE_DISTRIBUTING.html", subject: "Distribution started" },
  {
    eventType: "release.status",
    templateKey: "RELEASE_DELIVERED",
    filePath: "emails/templates/RELEASE_DELIVERED.html",
    subject: "Distribution delivery completed",
    dormant: true,
    dormantReason: "Provider-gated; only send on confirmed delivery callback.",
  },
  {
    eventType: "release.status",
    templateKey: "RELEASE_LIVE",
    filePath: "emails/templates/RELEASE_LIVE.html",
    subject: "Release live on stores",
    dormant: true,
    dormantReason: "Only send on real LIVE status transition.",
  },
  { eventType: "release.status", templateKey: "RELEASE_FAILED", filePath: "emails/templates/RELEASE_FAILED.html", subject: "Distribution failed" },
  { eventType: "release.status", templateKey: "RELEASE_UPDATE_REQUIRED", filePath: "emails/templates/RELEASE_UPDATE_REQUIRED.html", subject: "Release update requires action" },
  { eventType: "release.status", templateKey: "RELEASE_TAKEDOWN_REQUESTED", filePath: "emails/templates/RELEASE_TAKEDOWN_REQUESTED.html", subject: "Takedown request received" },
  { eventType: "release.status", templateKey: "RELEASE_TAKEDOWN_COMPLETED", filePath: "emails/templates/RELEASE_TAKEDOWN_COMPLETED.html", subject: "Release taken down" },

  { eventType: "account.status", templateKey: "ACCOUNT_SUSPENDED", filePath: "emails/templates/ACCOUNT_SUSPENDED.html", subject: "Account suspended" },
  { eventType: "account.status", templateKey: "ACCOUNT_RESTRICTED", filePath: "emails/templates/ACCOUNT_RESTRICTED.html", subject: "Account restriction applied" },
  { eventType: "account.status", templateKey: "ACCOUNT_RESTORED", filePath: "emails/templates/ACCOUNT_RESTORED.html", subject: "Account restored" },

  { eventType: "compliance", templateKey: "COMPLIANCE_WARNING", filePath: "emails/templates/COMPLIANCE_WARNING.html", subject: "Compliance warning" },
  { eventType: "compliance", templateKey: "COMPLIANCE_APPEAL_RECEIVED", filePath: "emails/templates/COMPLIANCE_APPEAL_RECEIVED.html", subject: "Compliance appeal received" },
  { eventType: "compliance", templateKey: "COMPLIANCE_APPEAL_DECISION", filePath: "emails/templates/COMPLIANCE_APPEAL_DECISION.html", subject: "Compliance appeal decision" },

  { eventType: "support", templateKey: "SUPPORT_TICKET_CREATED", filePath: "emails/templates/SUPPORT_TICKET_CREATED.html", subject: "Support ticket created" },
  { eventType: "support", templateKey: "SUPPORT_TICKET_REPLY", filePath: "emails/templates/SUPPORT_TICKET_REPLY.html", subject: "New reply on your support ticket" },
  { eventType: "contact", templateKey: "CONTACT_ACKNOWLEDGEMENT", filePath: "emails/templates/CONTACT_ACKNOWLEDGEMENT.html", subject: "We received your message" },
];

const byKey = new Map<TemplateKey, EmailCatalogEntry>(
  EMAIL_CATALOG.map((e) => [e.templateKey, e])
);

export function isApprovedTemplateKey(key: string): key is TemplateKey {
  return (APPROVED_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export function getCatalogEntry(key: string): EmailCatalogEntry | null {
  if (!isApprovedTemplateKey(key)) return null;
  return byKey.get(key) ?? null;
}

export function assertApprovedTemplateKey(key: string): TemplateKey {
  if (!isApprovedTemplateKey(key)) {
    throw new Error(`Unauthorized template key: ${key}`);
  }
  return key;
}

/** QC decision → template key(s). Does not invent LIVE. */
export function templateKeysForQcDecision(
  decision: "approve" | "request_changes" | "reject"
): TemplateKey[] {
  if (decision === "approve") return ["RELEASE_APPROVED"];
  if (decision === "request_changes") return ["RELEASE_CHANGES_REQUIRED"];
  if (decision === "reject") return ["RELEASE_REJECTED"];
  return [];
}

/** Status transition → template key (null if no mail / dormant gate left to caller). */
export function templateKeyForReleaseStatus(status: string): TemplateKey | null {
  switch (status) {
    case "submitted":
      return "RELEASE_SUBMITTED";
    case "in_qc":
      return "RELEASE_UNDER_REVIEW";
    case "changes_requested":
      return "RELEASE_CHANGES_REQUIRED";
    case "rejected":
      return "RELEASE_REJECTED";
    case "approved":
      return "RELEASE_APPROVED";
    case "scheduled":
      return "RELEASE_QUEUED";
    case "delivering":
      return "RELEASE_DISTRIBUTING";
    case "delivered":
      return "RELEASE_DELIVERED";
    case "live":
      return "RELEASE_LIVE";
    case "takedown_requested":
      return "RELEASE_TAKEDOWN_REQUESTED";
    case "taken_down":
      return "RELEASE_TAKEDOWN_COMPLETED";
    default:
      return null;
  }
}
