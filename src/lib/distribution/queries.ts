import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  DistributionJobRow,
  ProviderSubmissionRow,
  ProviderWebhookEventRow,
} from "./types";
import { sanitizeDistributionSearchQuery } from "./search";

export async function listDistributionJobs(filters?: {
  status?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
  let q = supabase
    .from("distribution_jobs")
    .select("*, releases(id, title, primary_artist_name, status, upc)")
    .order("queued_at", { ascending: false })
    .limit(limit);
  if (filters?.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<DistributionJobRow & { releases: unknown }>;
}

export async function listProviderSubmissions(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_submissions")
    .select("*, releases(id, title, primary_artist_name)")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return (data ?? []) as Array<ProviderSubmissionRow & { releases: unknown }>;
}

export async function listWebhookEvents(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_webhook_events")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return (data ?? []) as ProviderWebhookEventRow[];
}

export async function listFailedJobs(limit = 50) {
  return listDistributionJobs({ status: "failed", limit });
}

export async function listTakedownJobs(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("distribution_jobs")
    .select("*, releases(id, title, primary_artist_name, status)")
    .in("status", ["takedown_requested", "taken_down"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return data ?? [];
}

export async function listSyncRuns(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return data ?? [];
}

export async function getDistributionOverviewCounts() {
  const supabase = await createClient();
  const statuses = [
    "queued",
    "submitting",
    "submitted",
    "delivered",
    "live",
    "failed",
    "takedown_requested",
  ] as const;

  const counts: Record<(typeof statuses)[number], number> = {
    queued: 0,
    submitting: 0,
    submitted: 0,
    delivered: 0,
    live: 0,
    failed: 0,
    takedown_requested: 0,
  };
  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await supabase
        .from("distribution_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      counts[s] = count ?? 0;
    })
  );

  const { count: webhookCount } = await supabase
    .from("provider_webhook_events")
    .select("id", { count: "exact", head: true });

  return { ...counts, webhooks: webhookCount ?? 0 };
}

export async function searchDistribution(q: string) {
  const supabase = await createClient();
  const term = sanitizeDistributionSearchQuery(q);
  if (!term) return { releases: [], jobs: [] };

  const { data: releases } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name, status, upc, provider_release_id")
    .or(
      `title.ilike.%${term}%,primary_artist_name.ilike.%${term}%,upc.ilike.%${term}%,provider_release_id.ilike.%${term}%`
    )
    .limit(25);

  const { data: jobs } = await supabase
    .from("distribution_jobs")
    .select("id, release_id, status, provider_release_id, last_error")
    .or(`provider_release_id.ilike.%${term}%,last_error.ilike.%${term}%`)
    .limit(25);

  return { releases: releases ?? [], jobs: jobs ?? [] };
}
