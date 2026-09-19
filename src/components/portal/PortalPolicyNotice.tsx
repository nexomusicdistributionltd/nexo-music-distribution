import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function PortalPolicyNotice({userId}:{userId:string}){
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("nexo_outstanding_required_policy_count",{p_user_id:userId});
  const count=!error?Number(data??0):0;
  if(!count) return null;
  return <div className="mb-4 rounded-[var(--nexo-radius-lg)] border border-red-600/40 bg-red-600/10 px-4 py-3 text-small">
    <strong>{count} policy acceptance{count===1?"":"s"} required.</strong>{" "}
    <Link href="/account/policies" className="font-medium underline underline-offset-4">Review and accept</Link>
    {" "}before your next regulated account action.
  </div>;
}
