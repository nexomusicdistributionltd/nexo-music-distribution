"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function acceptPolicyVersionAction(formData: FormData) {
  await RequireVerifiedPortal();
  const id=String(formData.get("policy_version_id")??"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase=await createClient();
  const {error}=await supabase.rpc("accept_admin_policy_version",{p_policy_version_id:id});
  if(error) throw new Error(error.message);
  revalidatePath("/account/policies");
  revalidatePath("/dashboard");
}
