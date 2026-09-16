import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAddressList } from "./addresses";
import { parseSelectedUserIds, type AdminSelectAllKind } from "./campaign";
import type { ResolvedRecipient } from "./types";
import { artistNameOf } from "@/lib/auth/types";
import type { DirectoryRecipient } from "./directory";

export type { DirectoryKind, DirectoryRecipient } from "./directory";

export type AdminCampaignRecipientInput = {
  selectAllKind?: AdminSelectAllKind | null;
  /** @deprecated prefer selectAllKind: "user" */
  selectAll?: boolean;
  userIds?: string[];
  artistIds?: string[];
  labelIds?: string[];
  customEmails?: string[] | string;
  limit?: number;
};

type ProfileLite = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

function profileLabel(row: ProfileLite): string {
  return row.display_name?.trim() || row.full_name?.trim() || row.email?.trim() || "User";
}

export function profileToDirectory(row: ProfileLite): DirectoryRecipient {
  const email = row.email?.trim() || null;
  return {
    key: `user:${row.id}`,
    kind: "user",
    entityId: row.id,
    userId: row.id,
    email,
    label: profileLabel(row),
  };
}

export function artistToDirectory(
  row: {
    id: string;
    user_id?: string | null;
    profile_id?: string | null;
    stage_name?: string | null;
    artist_name?: string | null;
  },
  profileEmail?: string | null
): DirectoryRecipient {
  const userId = row.user_id || row.profile_id || null;
  return {
    key: `artist:${row.id}`,
    kind: "artist",
    entityId: row.id,
    userId,
    email: profileEmail?.trim() || null,
    label: artistNameOf({
      stage_name: row.stage_name || "Artist",
      artist_name: row.artist_name,
    }),
  };
}

export function labelToDirectory(
  row: {
    id: string;
    user_id?: string | null;
    label_name?: string | null;
    business_email?: string | null;
  },
  profileEmail?: string | null
): DirectoryRecipient {
  const email = row.business_email?.trim() || profileEmail?.trim() || null;
  return {
    key: `label:${row.id}`,
    kind: "label",
    entityId: row.id,
    userId: row.user_id || null,
    email,
    label: row.label_name?.trim() || email || "Label",
  };
}

function dedupeRecipients(rows: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ ...row, email });
  }
  return out;
}

function toProfileRecipient(row: ProfileLite, source: ResolvedRecipient["source"] = "profile"): ResolvedRecipient | null {
  const email = row.email?.trim();
  if (!email) return null;
  return {
    userId: row.id,
    email,
    source,
    displayName: profileLabel(row),
  };
}

async function loadProfilesByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name")
    .in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as ProfileLite[]).map((row) => [row.id, row]));
}

async function loadAllProfiles(
  supabase: SupabaseClient,
  limit: number
): Promise<{ recipients: ResolvedRecipient[]; skippedWithoutEmail: number }> {
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
    const rows = (data ?? []) as ProfileLite[];
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

async function resolveArtistIds(
  supabase: SupabaseClient,
  ids: string[] | "all",
  limit: number
): Promise<{ recipients: ResolvedRecipient[]; skippedWithoutEmail: number }> {
  if (ids !== "all" && ids.length === 0) return { recipients: [], skippedWithoutEmail: 0 };
  const query =
    ids === "all"
      ? supabase
          .from("artist_profiles")
          .select("id, user_id, profile_id, stage_name, artist_name")
          .order("created_at", { ascending: false })
          .limit(Math.min(limit, 2000))
      : supabase
          .from("artist_profiles")
          .select("id, user_id, profile_id, stage_name, artist_name")
          .in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const profileIds = rows
    .map((r) => r.user_id || r.profile_id)
    .filter((id): id is string => Boolean(id));
  const profiles = await loadProfilesByIds(supabase, profileIds);
  const recipients: ResolvedRecipient[] = [];
  let skippedWithoutEmail = 0;
  for (const row of rows) {
    const profile = profiles.get(row.user_id || row.profile_id || "") ?? null;
    const email = profile?.email?.trim();
    if (!email) {
      skippedWithoutEmail += 1;
      continue;
    }
    recipients.push({
      userId: profile?.id ?? row.user_id ?? null,
      email,
      source: "artist_profile",
      displayName: artistNameOf({
        stage_name: row.stage_name || "Artist",
        artist_name: row.artist_name,
      }),
    });
  }
  return { recipients, skippedWithoutEmail };
}

async function resolveLabelIds(
  supabase: SupabaseClient,
  ids: string[] | "all",
  limit: number
): Promise<{ recipients: ResolvedRecipient[]; skippedWithoutEmail: number }> {
  if (ids !== "all" && ids.length === 0) return { recipients: [], skippedWithoutEmail: 0 };
  const query =
    ids === "all"
      ? supabase
          .from("label_profiles")
          .select("id, user_id, label_name, business_email")
          .order("created_at", { ascending: false })
          .limit(Math.min(limit, 2000))
      : supabase
          .from("label_profiles")
          .select("id, user_id, label_name, business_email")
          .in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const profileIds = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));
  const profiles = await loadProfilesByIds(supabase, profileIds);
  const recipients: ResolvedRecipient[] = [];
  let skippedWithoutEmail = 0;
  for (const row of rows) {
    const profile = row.user_id ? profiles.get(row.user_id) : null;
    const email = row.business_email?.trim() || profile?.email?.trim() || "";
    if (!email) {
      skippedWithoutEmail += 1;
      continue;
    }
    recipients.push({
      userId: row.user_id ?? null,
      email,
      source: "label_profile",
      displayName: row.label_name,
    });
  }
  return { recipients, skippedWithoutEmail };
}

function customEmailRecipients(raw: string[] | string | undefined): ResolvedRecipient[] {
  const emails = parseAddressList(Array.isArray(raw) ? raw.join(",") : (raw ?? ""));
  return emails.map((email) => ({
    userId: null,
    email,
    source: "admin_explicit" as const,
    displayName: email,
  }));
}

/**
 * Admin send: artists, labels, profile users, plus explicit custom emails.
 * Directory emails still resolve from the database. Typed addresses are used
 * only on this admin:emails path (not for owner-mail automation).
 */
export async function resolveAdminCampaignRecipients(
  supabase: SupabaseClient,
  opts: AdminCampaignRecipientInput
): Promise<{ recipients: ResolvedRecipient[]; skippedWithoutEmail: number }> {
  const limit = opts.limit ?? 2000;
  const selectAllKind: AdminSelectAllKind | null =
    opts.selectAllKind ?? (opts.selectAll ? "user" : null);

  const collected: ResolvedRecipient[] = [];
  let skippedWithoutEmail = 0;

  const wantUsers = selectAllKind === "all" || selectAllKind === "user";
  const wantArtists = selectAllKind === "all" || selectAllKind === "artist";
  const wantLabels = selectAllKind === "all" || selectAllKind === "label";

  if (wantUsers) {
    const all = await loadAllProfiles(supabase, limit);
    collected.push(...all.recipients);
    skippedWithoutEmail += all.skippedWithoutEmail;
  } else {
    const ids = parseSelectedUserIds(opts.userIds ?? []);
    if (ids.length > 0) {
      const profiles = await loadProfilesByIds(supabase, ids);
      for (const id of ids) {
        const row = profiles.get(id);
        if (!row) continue;
        const r = toProfileRecipient(row);
        if (!r) skippedWithoutEmail += 1;
        else collected.push(r);
      }
    }
  }

  if (wantArtists) {
    const artists = await resolveArtistIds(supabase, "all", limit);
    collected.push(...artists.recipients);
    skippedWithoutEmail += artists.skippedWithoutEmail;
  } else {
    const artistIds = parseSelectedUserIds(opts.artistIds ?? []);
    if (artistIds.length > 0) {
      const artists = await resolveArtistIds(supabase, artistIds, limit);
      collected.push(...artists.recipients);
      skippedWithoutEmail += artists.skippedWithoutEmail;
    }
  }

  if (wantLabels) {
    const labels = await resolveLabelIds(supabase, "all", limit);
    collected.push(...labels.recipients);
    skippedWithoutEmail += labels.skippedWithoutEmail;
  } else {
    const labelIds = parseSelectedUserIds(opts.labelIds ?? []);
    if (labelIds.length > 0) {
      const labels = await resolveLabelIds(supabase, labelIds, limit);
      collected.push(...labels.recipients);
      skippedWithoutEmail += labels.skippedWithoutEmail;
    }
  }

  collected.push(...customEmailRecipients(opts.customEmails));

  return {
    recipients: dedupeRecipients(collected).slice(0, limit),
    skippedWithoutEmail,
  };
}

export async function listAdminEmailDirectory(
  supabase: SupabaseClient,
  limit = 400
): Promise<{ recipients: DirectoryRecipient[]; errors: string[] }> {
  const errors: string[] = [];
  const [{ data: users, error: userError }, { data: artists, error: artistError }, { data: labels, error: labelError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, full_name")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("artist_profiles")
        .select("id, user_id, profile_id, stage_name, artist_name")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("label_profiles")
        .select("id, user_id, label_name, business_email")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

  if (userError) errors.push(`Users: ${userError.message}`);
  if (artistError) errors.push(`Artists: ${artistError.message}`);
  if (labelError) errors.push(`Labels: ${labelError.message}`);

  const profileRows = (users ?? []) as ProfileLite[];
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));
  const extraIds = [
    ...(artists ?? []).map((a) => a.user_id || a.profile_id),
    ...(labels ?? []).map((l) => l.user_id),
  ].filter((id): id is string => Boolean(id) && !profileMap.has(id));
  if (extraIds.length > 0) {
    try {
      const extra = await loadProfilesByIds(supabase, extraIds);
      for (const [id, row] of extra) profileMap.set(id, row);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Could not load linked profile emails.");
    }
  }

  const recipients: DirectoryRecipient[] = [
    ...profileRows.map(profileToDirectory),
    ...(artists ?? []).map((row) => {
      const profile = profileMap.get(row.user_id || row.profile_id || "");
      return artistToDirectory(row, profile?.email);
    }),
    ...(labels ?? []).map((row) => {
      const profile = row.user_id ? profileMap.get(row.user_id) : undefined;
      return labelToDirectory(row, profile?.email);
    }),
  ];

  return { recipients, errors };
}
