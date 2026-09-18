import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { refreshFanlinkForRelease } from "./sync";
export async function drainFanlinkSyncJobs(limit=10){
 const db=createServiceClient();
 const {data:jobs,error}=await db.rpc("claim_fanlink_sync_jobs",{p_limit:Math.max(1,Math.min(limit,50))});
 if(error) throw new Error("Could not claim fanlink jobs.");
 for(const job of jobs??[]){
  try{
   await refreshFanlinkForRelease(job.release_id);
   await db.from("fanlink_sync_jobs").update({status:"done",last_error:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","processing");
  }catch(e){
   const attempts=Number(job.attempts??1);
   await db.from("fanlink_sync_jobs").update({status:attempts>=5?"failed":"queued",last_error:e instanceof Error?e.message:"Fanlink sync failed",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","processing");
  }
 }
 return {processed:(jobs??[]).length};
}
