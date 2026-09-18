export type IdentityVerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_information_required"
  | "verified"
  | "declined";

export type IdentityDocumentType =
  | "nin"
  | "national_id"
  | "drivers_license"
  | "passport";

export type IdentityEvidenceType =
  | "document_front"
  | "document_back"
  | "selfie";

export type IdentityVerificationRow = {
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
  created_at: string;
  updated_at: string;
};

export type IdentityEvidenceRow = {
  id: string;
  verification_id: string;
  user_id: string;
  evidence_type: IdentityEvidenceType;
  storage_path: string;
  captured_at: string;
  mime_type: string;
  size_bytes: number | null;
  capture_method?: "camera";
  sha256?: string | null;
  capture_metadata?: Record<string, unknown>;
  captured_client_at?: string | null;
};

export const DOCUMENT_LABELS: Record<IdentityDocumentType, string> = {
  nin: "NIN",
  national_id: "ID Card",
  drivers_license: "Driver's License",
  passport: "International Passport",
};

export function identityStatusLabel(status: IdentityVerificationStatus): string {
  switch (status) {
    case "draft":
      return "Verification required";
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "additional_information_required":
      return "Additional information required";
    case "verified":
      return "Verified";
    case "declined":
      return "Declined";
  }
}

export function identityNeedsAction(status: IdentityVerificationStatus | null | undefined): boolean {
  return !status || status === "draft" || status === "additional_information_required" || status === "declined";
}
