import { createClient } from "@/lib/supabase/server";
import { sanitizeReleaseSearchQuery } from "./safe-update";
import { normalizePageNumber, normalizePageSize } from "@/lib/pagination";
import type {
  NotificationRow,
  ReleaseAssetRow,
  ReleaseContributorRow,
  ReleaseRow,
  ReleaseStatus,
  ReleaseStatusHistoryRow,
  ReleaseTrackRow,
} from "./types";

export type ReleaseListFilters = {
  q?: string;
  status?: ReleaseStatus | "all";
  type?: string;
  sort?: "created_at" | "updated_at" | "title" | "release_date" | "status";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function getReleaseCounts(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("status")
    .eq("owner_user_id", userId);

  if (error) throw error;

  const counts = {
    total: 0,
    drafts: 0,
    submittedQc: 0,
    approved: 0,
    deliveredLive: 0,
    rejectedAction: 0,
  };

  for (const row of data ?? []) {
    counts.total += 1;
    const s = row.status as ReleaseStatus;
    if (s === "draft") counts.drafts += 1;
    else if (s === "submitted" || s === "in_qc") counts.submittedQc += 1;
    else if (s === "approved" || s === "scheduled") counts.approved += 1;
    else if (s === "delivered" || s === "live" || s === "delivering") counts.deliveredLive += 1;
    else if (s === "rejected" || s === "changes_requested" || s === "takedown_requested") {
      counts.rejectedAction += 1;
    }
  }

  return counts;
}

export async function listReleases(userId: string, filters: ReleaseListFilters = {}) {
  const supabase = await createClient();
  const page = normalizePageNumber(filters.page);
  const pageSize = normalizePageSize(filters.pageSize, 20, 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = filters.sort ?? "updated_at";
  const ascending = (filters.order ?? "desc") === "asc";

  let query = supabase
    .from("releases")
    .select("*", { count: "exact" })
    .eq("owner_user_id", userId);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.type && filters.type !== "all") {
    query = query.eq("release_type", filters.type);
  }
  if (filters.q?.trim()) {
    const cleaned = sanitizeReleaseSearchQuery(filters.q);
    if (cleaned) {
      const q = `%${cleaned}%`;
      query = query.or(`title.ilike.${q},primary_artist_name.ilike.${q}`);
    }
  }

  query = query.order(sort, { ascending }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as ReleaseRow[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getReleaseDetail(releaseId: string) {
  const supabase = await createClient();
  const { data: release, error } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!release) return null;

  const [tracks, contributors, assets, history] = await Promise.all([
    supabase
      .from("release_tracks")
      .select("*")
      .eq("release_id", releaseId)
      .order("track_number", { ascending: true }),
    supabase.from("release_contributors").select("*").eq("release_id", releaseId),
    supabase.from("release_assets").select("*").eq("release_id", releaseId),
    supabase
      .from("release_status_history")
      .select("*")
      .eq("release_id", releaseId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    release: release as ReleaseRow,
    tracks: (tracks.data ?? []) as ReleaseTrackRow[],
    contributors: (contributors.data ?? []) as ReleaseContributorRow[],
    assets: (assets.data ?? []) as ReleaseAssetRow[],
    history: (history.data ?? []) as ReleaseStatusHistoryRow[],
  };
}

export async function listRecentReleases(userId: string, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReleaseRow[];
}

export async function listActionNeededReleases(userId: string, limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("owner_user_id", userId)
    .in("status", ["changes_requested", "rejected", "failed", "takedown_requested"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReleaseRow[];
}

export async function listNotifications(userId: string, limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function countUnreadNotifications(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}
