import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IdentityVerification } from "@/lib/identity/types";

export async function getIdentityVerificationForUser(
  userId: string
): Promise<IdentityVerification | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("identity_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as IdentityVerification | null) ?? null;
}

export async function isIdentityVerified(userId: string): Promise<boolean> {
  const row = await getIdentityVerificationForUser(userId);
  return row?.status === "verified";
}
