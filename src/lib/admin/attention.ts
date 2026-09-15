import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AttentionItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  tone: "urgent" | "warning" | "info";
};

export type AdminAttention = {
  qcOpen: number;
  changesRequested: number;
  deliveryFailed: number;
  upcoming: number;
  newArtists7d: number;
  newLabels7d: number;
  newContact: number;
  openTickets: number;
  failedEmail: number;
  ddexFailed: number;
  items: AttentionItem[];
};

function sinceDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function countEq(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}

export async function getAdminAttention(): Promise<AdminAttention> {
  const supabase = await createClient();
  const week = sinceDays(7);

  const [
    submitted,
    inQc,
    changesRequested,
    deliveryFailed,
    upcoming,
    newArtists7d,
    newLabels7d,
    newContact,
    openTickets,
    failedEmail,
    ddexInvalid,
    ddexDeliveryFailed,
    qcSample,
    changesSample,
    failedSample,
    contactSample,
    upcomingSample,
  ] = await Promise.all([
    countEq("releases", "status", "submitted"),
    countEq("releases", "status", "in_qc"),
    countEq("releases", "status", "changes_requested"),
    countEq("releases", "status", "failed"),
    countEq("releases", "status", "scheduled"),
    supabase
      .from("artist_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", week)
      .then((r) => r.count ?? 0),
    supabase
      .from("label_profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", week)
      .then((r) => r.count ?? 0),
    supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .then((r) => r.count ?? 0),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending", "awaiting_user"])
      .then((r) => r.count ?? 0),
    supabase
      .from("email_outbound_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .then((r) => r.count ?? 0, () => 0),
    supabase
      .from("ddex_messages")
      .select("id", { count: "exact", head: true })
      .eq("validation_status", "invalid")
      .then((r) => r.count ?? 0, () => 0),
    supabase
      .from("ddex_messages")
      .select("id", { count: "exact", head: true })
      .eq("delivery_status", "failed")
      .then((r) => r.count ?? 0, () => 0),
    supabase
      .from("qc_queue_items")
      .select("id, release_id, priority, status, releases(title, primary_artist_name)")
      .in("status", ["queued", "claimed", "in_review"])
      .order("created_at", { ascending: true })
      .limit(6)
      .then((r) => r.data ?? []),
    supabase
      .from("releases")
      .select("id, title, primary_artist_name, changes_requested_reason")
      .eq("status", "changes_requested")
      .order("updated_at", { ascending: false })
      .limit(4)
      .then((r) => r.data ?? []),
    supabase
      .from("releases")
      .select("id, title, primary_artist_name")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(4)
      .then((r) => r.data ?? []),
    supabase
      .from("contact_messages")
      .select("id, name, subject, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(4)
      .then((r) => r.data ?? []),
    supabase
      .from("releases")
      .select("id, title, primary_artist_name, release_date")
      .eq("status", "scheduled")
      .order("release_date", { ascending: true })
      .limit(4)
      .then((r) => r.data ?? []),
  ]);

  const items: AttentionItem[] = [];

  for (const row of qcSample as Array<{
    id: string;
    release_id: string;
    priority: string;
    status: string;
    releases: { title?: string; primary_artist_name?: string } | null;
  }>) {
    items.push({
      id: `qc-${row.id}`,
      href: `/admin/releases/${row.release_id}`,
      title: row.releases?.title || "Untitled release",
      meta: `QC · ${row.releases?.primary_artist_name || "—"} · ${row.priority} · ${row.status}`,
      tone: row.priority === "urgent" || row.priority === "high" ? "urgent" : "warning",
    });
  }

  for (const row of changesSample as Array<{
    id: string;
    title: string;
    primary_artist_name: string;
  }>) {
    items.push({
      id: `cr-${row.id}`,
      href: `/admin/releases/${row.id}`,
      title: row.title || "Untitled release",
      meta: `Changes requested · ${row.primary_artist_name || "—"}`,
      tone: "warning",
    });
  }

  for (const row of failedSample as Array<{
    id: string;
    title: string;
    primary_artist_name: string;
  }>) {
    items.push({
      id: `fail-${row.id}`,
      href: `/admin/distribution/failed`,
      title: row.title || "Untitled release",
      meta: `Delivery failed · ${row.primary_artist_name || "—"}`,
      tone: "urgent",
    });
  }

  for (const row of contactSample as Array<{
    id: string;
    name: string;
    subject: string;
  }>) {
    items.push({
      id: `in-${row.id}`,
      href: "/admin/contact",
      title: row.subject || "Inquiry",
      meta: `Inquiry · ${row.name || "—"}`,
      tone: "info",
    });
  }

  for (const row of upcomingSample as Array<{
    id: string;
    title: string;
    primary_artist_name: string;
    release_date: string | null;
  }>) {
    items.push({
      id: `up-${row.id}`,
      href: `/admin/releases/${row.id}`,
      title: row.title || "Untitled release",
      meta: `Upcoming · ${row.primary_artist_name || "—"}${row.release_date ? ` · ${row.release_date}` : ""}`,
      tone: "info",
    });
  }

  return {
    qcOpen: submitted + inQc,
    changesRequested,
    deliveryFailed,
    upcoming,
    newArtists7d,
    newLabels7d,
    newContact,
    openTickets,
    failedEmail,
    ddexFailed: ddexInvalid + ddexDeliveryFailed,
    items,
  };
}
