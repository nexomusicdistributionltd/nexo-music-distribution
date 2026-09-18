import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  IdentityEvidenceRow,
  IdentityVerificationRow,
} from "@/lib/identity/types";

export async function getIdentityVerificationForUser(
  userId: string
): Promise<IdentityVerificationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identity_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getIdentityVerificationForUser", error.message);
    return null;
  }
  return (data as IdentityVerificationRow | null) ?? null;
}

export async function listIdentityEvidence(
  verificationId: string
): Promise<IdentityEvidenceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identity_verification_evidence")
    .select("*")
    .eq("verification_id", verificationId)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IdentityEvidenceRow[];
}

export async function isIdentityVerified(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("identity_verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.identity_verified_at);
}
