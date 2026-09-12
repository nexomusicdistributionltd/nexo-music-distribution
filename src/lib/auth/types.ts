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
  account_status: AccountStatus;
  account_type: AppRole;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  stage_name: string;
  bio: string | null;
  website: string | null;
}

export interface LabelProfile {
  id: string;
  user_id: string;
  label_name: string;
  contact_name: string;
  business_email: string;
  website: string | null;
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
  if (roles.includes("super_admin") || roles.includes("admin")) return "/admin";
  if (roles.includes("support")) return "/support";
  if (roles.includes("artist") || roles.includes("label")) return "/dashboard";
  return "/profile";
}
