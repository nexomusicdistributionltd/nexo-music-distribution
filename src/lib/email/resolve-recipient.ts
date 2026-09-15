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

export type ProfileRecipientRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

function toProfileRecipient(row: ProfileRecipientRow): ResolvedRecipient | null {
  const email = row.email?.trim();
  if (!email) return null;
  return {
    userId: row.id,
    email,
    source: "profile",
    displayName: row.display_name || row.full_name,
  };
}

/**
 * Newsletter / manual send: resolve from DB profiles by id.
 * Ignores any client-supplied email addresses.
 */
export async function resolveManualRecipients(
  supabase: SupabaseClient,
  opts: { userIds?: string[]; selectAll?: boolean; limit?: number }
): Promise<{ recipients: ResolvedRecipient[]; skippedWithoutEmail: number }> {
  const limit = opts.limit ?? 2000;
  if (opts.selectAll) {
    const recipients: ResolvedRecipient[] = [];
    let skippedWithoutEmail = 0;
    let from = 0;
    const pageSize = 1000;
    while (recipients.length < limit) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name")
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as ProfileRecipientRow[];
      if (rows.length === 0) break;
      for (const row of rows) {
        const r = toProfileRecipient(row);
        if (!r) {
          skippedWithoutEmail += 1;
          continue;
        }
        recipients.push(r);
        if (recipients.length >= limit) break;
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return { recipients, skippedWithoutEmail };
  }

  const ids = [...new Set((opts.userIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { recipients: [], skippedWithoutEmail: 0 };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const found = new Map(
    ((data ?? []) as ProfileRecipientRow[]).map((row) => [row.id, row])
  );
  const recipients: ResolvedRecipient[] = [];
  let skippedWithoutEmail = 0;
  for (const id of ids) {
    const row = found.get(id);
    if (!row) continue;
    const r = toProfileRecipient(row);
    if (!r) {
      skippedWithoutEmail += 1;
      continue;
    }
    recipients.push(r);
  }
  return { recipients, skippedWithoutEmail };
}

/** Contact form acknowledgement — email comes from the persisted contact_messages row (server RPC), not a raw client trust boundary for owner mail. */
export function resolveContactSubmissionRecipient(email: string): ResolvedRecipient {
  return {
    userId: null,
    email: email.trim().toLowerCase(),
    source: "contact_submission",
  };
}
