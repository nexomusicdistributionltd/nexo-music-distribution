import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedRecipient } from "./types";

/**
 * Resolve recipient from release owner profile / auth — NEVER trust client email.
 * Label: owner resolution uses releases.owner_user_id → profiles.email.
 */
export async function resolveReleaseOwnerRecipient(
  supabase: SupabaseClient,
  releaseId: string
): Promise<ResolvedRecipient | null> {
  const { data: release, error } = await supabase
    .from("releases")
    .select("id, owner_user_id, title, primary_artist_name")
    .eq("id", releaseId)
    .maybeSingle();
  if (error || !release?.owner_user_id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name")
    .eq("id", release.owner_user_id)
    .maybeSingle();

  if (profile?.email) {
    return {
      userId: profile.id,
      email: profile.email,
      source: "release_owner_profile",
      displayName: profile.display_name || profile.full_name,
    };
  }

  return null;
}

export async function resolveProfileRecipient(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedRecipient | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.email) return null;
  return {
    userId: profile.id,
    email: profile.email,
    source: "profile",
    displayName: profile.display_name || profile.full_name,
  };
}

/** Contact form acknowledgement — email comes from the persisted contact_messages row (server RPC), not a raw client trust boundary for owner mail. */
export function resolveContactSubmissionRecipient(email: string): ResolvedRecipient {
  return {
    userId: null,
    email: email.trim().toLowerCase(),
    source: "contact_submission",
  };
}
