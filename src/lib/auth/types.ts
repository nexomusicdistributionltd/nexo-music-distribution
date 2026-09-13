export type AppRole =
  | "public_user"
  | "artist"
  | "label"
  | "support"
  | "admin"
  | "super_admin";

export type AccountStatus =
  | "active"
  | "pending_verification"
  | "suspended"
  | "deactivated";

export type SignupRole = "artist" | "label";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  country: string | null;
  avatar_url: string | null;
  timezone?: string | null;
  language?: string | null;
  account_status: AccountStatus;
  account_type: AppRole;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  profile_id?: string | null;
  stage_name: string;
  artist_name?: string | null;
  bio: string | null;
  website: string | null;
  country?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
}

export interface LabelProfile {
  id: string;
  user_id: string;
  label_name: string;
  contact_name: string;
  business_email: string;
  website: string | null;
  legal_business_name?: string | null;
  logo_url?: string | null;
  description?: string | null;
  country?: string | null;
}

export interface AuthUserContext {
  userId: string;
  email: string;
  emailVerified: boolean;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
}

export const PRIVILEGED_ROLES: AppRole[] = ["support", "admin", "super_admin"];
export const PUBLIC_SIGNUP_ROLES: SignupRole[] = ["artist", "label"];

export function isBlockedStatus(status: AccountStatus | null | undefined): boolean {
  return status === "suspended" || status === "deactivated";
}

export function homePathForRoles(roles: AppRole[]): string {
  if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("support")) {
    return "/admin";
  }
  if (roles.includes("artist") || roles.includes("label")) return "/dashboard";
  return "/profile";
}

/** Canonical artist display name (artist_name with stage_name fallback). */
export function artistNameOf(row: Pick<ArtistProfile, "stage_name"> & { artist_name?: string | null }): string {
  return row.artist_name?.trim() || row.stage_name;
}
