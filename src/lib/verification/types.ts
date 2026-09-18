export type IdentityDocumentType =
  | "nin"
  | "national_id"
  | "drivers_license"
  | "passport";

export type IdentityVerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_information_required"
  | "verified"
  | "declined";

export type IdentityEvidenceType =
  | "document_front"
  | "document_back"
  | "selfie";

export type IdentityVerification = {
  id: string;
  user_id: string;
  account_type: "artist" | "label";
  country_code: string;
  legal_full_name: string;
  date_of_birth: string;
  document_type: IdentityDocumentType;
  status: IdentityVerificationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decline_reason: string | null;
  additional_information_request: string | null;
  risk_notes: string | null;
  consented_at?: string | null;
  consent_version?: string | null;
  created_at: string;
  updated_at: string;
};

export type IdentityEvidence = {
  id: string;
  verification_id: string;
  user_id: string;
  evidence_type: IdentityEvidenceType;
  storage_path: string;
  captured_at: string;
  mime_type: string;
  size_bytes: number | null;
  capture_metadata?: Record<string, unknown> | null;
};

export const DOCUMENT_LABELS: Record<IdentityDocumentType, string> = {
  nin: "NIN",
  national_id: "ID Card / National ID",
  drivers_license: "Driver’s License",
  passport: "International Passport",
};

export const EVIDENCE_LABELS: Record<IdentityEvidenceType, string> = {
  document_front: "Document front",
  document_back: "Document back",
  selfie: "Live face capture",
};
