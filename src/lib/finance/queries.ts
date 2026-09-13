import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function fetchLedgerBalances(ownerUserId?: string) {
  const supabase = await createClient();
  let q = supabase.from("ledger_balances").select("*");
  if (ownerUserId) q = q.eq("owner_user_id", ownerUserId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchLedgerEntries(opts: {
  ownerUserId?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("ledger_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
  if (opts.ownerUserId) q = q.eq("owner_user_id", opts.ownerUserId);
  const { data, error, count } = await q;
  if (error) return { data: [], error: error.message, count: 0 };
  return { data: data ?? [], error: null, count: count ?? data?.length ?? 0 };
}

export async function fetchStatements(opts: { ownerUserId?: string; limit?: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("royalty_statements")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.ownerUserId) q = q.eq("owner_user_id", opts.ownerUserId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchPayouts(opts: { ownerUserId?: string; limit?: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.ownerUserId) q = q.eq("owner_user_id", opts.ownerUserId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchImportBatches(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("royalty_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchSplitRules(ownerUserId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("royalty_split_rules")
    .select("*, royalty_split_shares(*)")
    .order("effective_from", { ascending: false });
  if (ownerUserId) q = q.eq("owner_user_id", ownerUserId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchPublishingWorks(ownerUserId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("publishing_works")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (ownerUserId) q = q.eq("owner_user_id", ownerUserId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
