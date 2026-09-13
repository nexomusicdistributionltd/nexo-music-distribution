/** Approved operational + auth template keys (allowlist only). */
export const APPROVED_TEMPLATE_KEYS = [
  // Auth (Supabase Go templates live under supabase/templates)
  "AUTH_CONFIRMATION",
  "AUTH_INVITE",
  "AUTH_MAGIC_LINK",
  "AUTH_RECOVERY",
  "AUTH_EMAIL_CHANGE",
  "AUTH_REAUTHENTICATION",
  // Operational
  "RELEASE_SUBMITTED",
  "RELEASE_UNDER_REVIEW",
  "RELEASE_CHANGES_REQUIRED",
  "RELEASE_REJECTED",
  "RELEASE_APPROVED",
  "RELEASE_QUEUED",
  "RELEASE_DISTRIBUTING",
  "RELEASE_DELIVERED",
  "RELEASE_LIVE",
  "RELEASE_FAILED",
  "RELEASE_UPDATE_REQUIRED",
  "RELEASE_TAKEDOWN_REQUESTED",
  "RELEASE_TAKEDOWN_COMPLETED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_RESTRICTED",
  "ACCOUNT_RESTORED",
  "COMPLIANCE_WARNING",
  "COMPLIANCE_APPEAL_RECEIVED",
  "COMPLIANCE_APPEAL_DECISION",
  "SUPPORT_TICKET_CREATED",
  "SUPPORT_TICKET_REPLY",
  "CONTACT_ACKNOWLEDGEMENT",
] as const;

export type TemplateKey = (typeof APPROVED_TEMPLATE_KEYS)[number];

export type EmailEventStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "unavailable";

export type EmailEventType =
  | "release.status"
  | "release.qc"
  | "release.submit"
  | "account.status"
  | "compliance"
  | "support"
  | "contact"
  | "auth"
  | "manual.retry";

export interface EmailCatalogEntry {
  eventType: EmailEventType;
  templateKey: TemplateKey;
  /** Repo-relative path to HTML template (operational only). Auth keys use supabase/templates. */
  filePath: string | null;
  subject: string;
  /** When true, architecture includes template but sending is gated. */
  dormant?: boolean;
  dormantReason?: string;
}

export interface EmailSendResult {
  accepted: boolean;
  messageId?: string;
  error?: string;
  /** Truthful provider identity; never invent success. */
  provider: string;
  unavailable?: boolean;
}

export interface EmailProvider {
  readonly name: string;
  send(input: {
    to: string;
    subject: string;
    html: string;
    from?: string;
    idempotencyKey?: string;
  }): Promise<EmailSendResult>;
}

export interface RenderInput {
  templateKey: TemplateKey;
  vars: Record<string, string | number | null | undefined>;
}

export interface ResolvedRecipient {
  userId: string | null;
  email: string;
  /** How the address was resolved — never trust client-supplied email for owner mail. */
  source: "release_owner_profile" | "profile" | "auth_users" | "contact_submission" | "explicit_server";
  displayName?: string | null;
}

export interface EnqueueEmailInput {
  eventType: EmailEventType;
  templateKey: TemplateKey;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  relatedReleaseId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  createdBy?: string | null;
}
