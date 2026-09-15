import { EMAIL_CATALOG, getCatalogEntry } from "./catalog";
import type { TemplateKey } from "./types";

export type EmailRecipientType =
  | "release_owner"
  | "account_user"
  | "contact_submitter"
  | "ticket_requester"
  | "newsletter_subscriber"
  | "staff"
  | "auth_supabase";

export type EmailAutomationSpec = {
  key: string;
  catalogKey: TemplateKey | null;
  name: string;
  trigger: string;
  recipientType: EmailRecipientType;
  enabledByDefault: boolean;
  dormant: boolean;
  hostedBySupabase: boolean;
};

function catalogSpec(
  key: TemplateKey,
  trigger: string,
  recipientType: EmailRecipientType,
  opts?: { enabledByDefault?: boolean }
): EmailAutomationSpec {
  const entry = getCatalogEntry(key);
  return {
    key,
    catalogKey: key,
    name: entry?.subject ?? key,
    trigger,
    recipientType,
    enabledByDefault: opts?.enabledByDefault ?? !entry?.dormant,
    dormant: Boolean(entry?.dormant),
    hostedBySupabase: entry?.eventType === "auth",
  };
}

/** NexoBot catalog + optional admin internals. Auth keys are listed, never outbox-sent. */
export const EMAIL_AUTOMATION_SPECS: EmailAutomationSpec[] = [
  catalogSpec("AUTH_CONFIRMATION", "Supabase Auth confirmation (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("AUTH_INVITE", "Supabase Auth invite (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("AUTH_MAGIC_LINK", "Supabase Auth magic link (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("AUTH_RECOVERY", "Supabase Auth recovery (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("AUTH_EMAIL_CHANGE", "Supabase Auth email change (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("AUTH_REAUTHENTICATION", "Supabase Auth reauthentication (hosted)", "auth_supabase", {
    enabledByDefault: false,
  }),
  catalogSpec("RELEASE_SUBMITTED", "Release status → submitted", "release_owner"),
  catalogSpec("RELEASE_UNDER_REVIEW", "Release status → in_qc", "release_owner"),
  catalogSpec("RELEASE_CHANGES_REQUIRED", "QC request changes (pre-approval)", "release_owner"),
  catalogSpec("RELEASE_REJECTED", "QC reject", "release_owner"),
  catalogSpec("RELEASE_APPROVED", "QC approve / status → approved", "release_owner"),
  catalogSpec("RELEASE_QUEUED", "Release status → scheduled", "release_owner"),
  catalogSpec("RELEASE_DISTRIBUTING", "Release status → delivering", "release_owner"),
  catalogSpec("RELEASE_DELIVERED", "Provider delivery callback only", "release_owner"),
  catalogSpec("RELEASE_LIVE", "Provider LIVE callback only", "release_owner"),
  catalogSpec("RELEASE_FAILED", "Release status → failed", "release_owner"),
  catalogSpec("RELEASE_UPDATE_REQUIRED", "Changes requested after approval", "release_owner"),
  catalogSpec("RELEASE_TAKEDOWN_REQUESTED", "Release status → takedown_requested", "release_owner"),
  catalogSpec("RELEASE_TAKEDOWN_COMPLETED", "Release status → taken_down", "release_owner"),
  catalogSpec("ACCOUNT_SUSPENDED", "Admin set account_status=suspended", "account_user"),
  catalogSpec("ACCOUNT_RESTRICTED", "Admin restriction applied", "account_user"),
  catalogSpec("ACCOUNT_RESTORED", "Admin restore to active", "account_user"),
  catalogSpec("COMPLIANCE_WARNING", "Staff compliance case warning", "account_user"),
  catalogSpec("COMPLIANCE_APPEAL_RECEIVED", "Compliance appeal submitted", "account_user"),
  catalogSpec("COMPLIANCE_APPEAL_DECISION", "Staff appeal decision", "account_user"),
  catalogSpec("SUPPORT_TICKET_CREATED", "Portal ticket insert", "ticket_requester"),
  catalogSpec("SUPPORT_TICKET_REPLY", "Staff or requester ticket reply", "ticket_requester"),
  catalogSpec("CONTACT_ACKNOWLEDGEMENT", "Public contact form submit", "contact_submitter"),
  catalogSpec("NEWSLETTER", "Admin newsletter campaign", "newsletter_subscriber"),
  catalogSpec("NEW_MUSIC_FRIDAY", "Admin New Music Friday campaign", "newsletter_subscriber"),
  {
    key: "ADMIN_NEW_ARTIST",
    catalogKey: null,
    name: "Admin: new artist",
    trigger: "Artist profile created",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
  {
    key: "ADMIN_NEW_LABEL",
    catalogKey: null,
    name: "Admin: new label",
    trigger: "Label profile created",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
  {
    key: "ADMIN_RELEASE_SUBMITTED",
    catalogKey: null,
    name: "Admin: release submitted",
    trigger: "Release submitted to QC",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
  {
    key: "ADMIN_QC_READY",
    catalogKey: null,
    name: "Admin: QC ready",
    trigger: "Release entered in_qc",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
  {
    key: "ADMIN_INQUIRY",
    catalogKey: null,
    name: "Admin: website inquiry",
    trigger: "Public contact form",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
  {
    key: "ADMIN_CRITICAL_FAILURE",
    catalogKey: null,
    name: "Admin: critical failure",
    trigger: "Delivery / DDEX / email failure",
    recipientType: "staff",
    enabledByDefault: false,
    dormant: false,
    hostedBySupabase: false,
  },
];

export function isHostedAuthAutomation(key: string): boolean {
  return key.startsWith("AUTH_");
}

export function isDormantCatalogKey(key: string): boolean {
  const entry = getCatalogEntry(key);
  return Boolean(entry?.dormant);
}

export function catalogKeysCoveredByAutomations(): TemplateKey[] {
  return EMAIL_CATALOG.map((e) => e.templateKey);
}
