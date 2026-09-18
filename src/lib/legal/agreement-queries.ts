import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getSignedDistributionAgreement(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("distribution_agreements")
    .select("id,user_id,verification_id,agreement_version,legal_name,signed_at,status,pdf_path,document_sha256")
    .eq("user_id", userId)
    .eq("status", "signed")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function hasSignedDistributionAgreement(userId: string): Promise<boolean> {
  return Boolean(await getSignedDistributionAgreement(userId));
}
