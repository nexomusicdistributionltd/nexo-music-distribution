import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { refreshFanlinkForRelease } from "./sync";
export async function drainFanlinkSyncJobs(limit=10){
 const db=createServiceClient();
 const {data:jobs}=await db.from("fanlink_sync_jobs").select("id,release_id,attempts").eq("status","queued").order("created_at").limit(limit);
 for(const job of jobs??[]){
  await db.from("fanlink_sync_jobs").update({status:"processing",attempts:job.attempts+1,updated_at:new Date().toISOString()}).eq("id",job.id);
  try{await refreshFanlinkForRelease(job.release_id);await db.from("fanlink_sync_jobs").update({status:"done",last_error:null,updated_at:new Date().toISOString()}).eq("id",job.id)}
  catch(e){await db.from("fanlink_sync_jobs").update({status:job.attempts+1>=5?"failed":"queued",last_error:e instanceof Error?e.message:"Fanlink sync failed",updated_at:new Date().toISOString()}).eq("id",job.id)}
 }
}
