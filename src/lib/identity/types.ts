export type IdentityVerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "declined"
  | "additional_info_required";

export type IdentityDocumentType =
  | "nin"
  | "national_id"
  | "drivers_license"
  | "passport";

export type IdentityVerification = {
  id: string;
  user_id: string;
  country_code: string;
  legal_name: string;
  date_of_birth: string;
  document_type: IdentityDocumentType;
  status: IdentityVerificationStatus;
  latest_submission_id: string | null;
  reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  verified_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IdentitySubmission = {
  id: string;
  verification_id: string;
  user_id: string;
  document_type: IdentityDocumentType;
  document_front_path: string | null;
  document_back_path: string | null;
  selfie_path: string | null;
  status: IdentityVerificationStatus;
  reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

export const IDENTITY_DOCUMENT_LABELS: Record<IdentityDocumentType, string> = {
  nin: "NIN",
  national_id: "ID Card",
  drivers_license: "Driver's License",
  passport: "International Passport",
};
