import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery, type AdminSearchEntity } from "./search";
import type { ReleaseStatus } from "@/lib/releases/types";

export async function getAdminOperationalCounts() {
  const supabase = await createClient();

  const [
    releases,
    submitted,
    inQc,
    artists,
    labels,
    openTickets,
    newContact,
    openCompliance,
  ] = await Promise.all([
    supabase.from("releases").select("id", { count: "exact", head: true }),
    supabase
      .from("releases")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("releases")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_qc"),
    supabase.from("artist_profiles").select("id", { count: "exact", head: true }),
    supabase.from("label_profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending", "awaiting_user"]),
    supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("compliance_cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating", "escalated"]),
  ]);

  return {
    releases: releases.count ?? 0,
    submitted: submitted.count ?? 0,
    inQc: inQc.count ?? 0,
    artists: artists.count ?? 0,
    labels: labels.count ?? 0,
    openTickets: openTickets.count ?? 0,
    newContact: newContact.count ?? 0,
    openCompliance: openCompliance.count ?? 0,
  };
}

export async function listAdminReleases(filters: {
  q?: string;
  status?: ReleaseStatus | "all";
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("releases")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.fromDate) {
    query = query.gte("created_at", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
  }
  const q = sanitizeAdminSearchQuery(filters.q);
  if (q) {
    query = query.or(`title.ilike.%${q}%,primary_artist_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function listQcQueue(filters: {
  status?: string;
  priority?: string;
  assigned?: "me" | "unassigned" | "all";
  userId?: string;
  page?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("qc_queue_items")
    .select("*, releases(*)", { count: "exact" })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", ["queued", "claimed", "in_review"]);
  }
  if (filters.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters.assigned === "unassigned") {
    query = query.is("assigned_to", null);
  } else if (filters.assigned === "me" && filters.userId) {
    query = query.eq("assigned_to", filters.userId);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}

export async function globalAdminSearch(qRaw: string, entities: AdminSearchEntity[]) {
  const supabase = await createClient();
  const q = sanitizeAdminSearchQuery(qRaw);
  if (!q) {
    return { q: "", groups: {} as Record<string, unknown[]> };
  }

  const groups: Record<string, unknown[]> = {};

  if (entities.includes("release")) {
    const { data } = await supabase
      .from("releases")
      .select("id, title, primary_artist_name, status, updated_at")
      .or(`title.ilike.%${q}%,primary_artist_name.ilike.%${q}%`)
      .limit(10);
    groups.release = data ?? [];
  }
  if (entities.includes("artist")) {
    const { data } = await supabase
      .from("artist_profiles")
      .select("id, user_id, stage_name, artist_name")
      .or(`stage_name.ilike.%${q}%,artist_name.ilike.%${q}%`)
      .limit(10);
    groups.artist = data ?? [];
  }
  if (entities.includes("label")) {
    const { data } = await supabase
      .from("label_profiles")
      .select("id, user_id, label_name, business_email")
      .or(`label_name.ilike.%${q}%,business_email.ilike.%${q}%`)
      .limit(10);
    groups.label = data ?? [];
  }
  if (entities.includes("user")) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, display_name, account_status, account_type")
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    groups.user = data ?? [];
  }
  if (entities.includes("ticket")) {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, status, priority, updated_at")
      .ilike("subject", `%${q}%`)
      .limit(10);
    groups.ticket = data ?? [];
  }
  if (entities.includes("contact")) {
    const { data } = await supabase
      .from("contact_messages")
      .select("id, name, email, subject, status, created_at")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,subject.ilike.%${q}%`)
      .limit(10);
    groups.contact = data ?? [];
  }
  if (entities.includes("compliance")) {
    const { data } = await supabase
      .from("compliance_cases")
      .select("id, title, status, created_at")
      .ilike("title", `%${q}%`)
      .limit(10);
    groups.compliance = data ?? [];
  }

  return { q, groups };
}

export const SIGNED_ASSET_BUCKETS = [
  "release-audio",
  "release-artwork",
  "compliance-evidence",
  "support-attachments",
  "avatars",
] as const;

export function isAllowedSignedAssetTarget(bucket: string, path: string): boolean {
  if (!(SIGNED_ASSET_BUCKETS as readonly string[]).includes(bucket)) return false;
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return false;
  }
  return true;
}

export async function createSignedAssetUrl(
  bucket: string,
  path: string,
  expiresIn = 120
): Promise<string | null> {
  if (!isAllowedSignedAssetTarget(bucket, path)) return null;
  const ttl = Math.min(300, Math.max(30, expiresIn));
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error) return null;
  return data.signedUrl;
}


export async function listAuditLogs(filters: {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  action?: string;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.fromDate) query = query.gte("created_at", filters.fromDate);
  if (filters.toDate) query = query.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
  if (filters.action) query = query.eq("action", filters.action);
  const { data, error, count } = await query;
  if (error) throw error;
  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}
