import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=createServiceClient();
 const {data:f}=await db.from("fanlinks").select("preview_storage_bucket,preview_storage_path,preview_ready,is_published").eq("id",id).maybeSingle();
 if(!f?.is_published||!f.preview_ready||f.preview_storage_bucket!=="fanlink-previews"||!f.preview_storage_path)return new NextResponse(null,{status:404});
 const {data:signed,error}=await db.storage.from("fanlink-previews").createSignedUrl(f.preview_storage_path,60);
 if(error||!signed?.signedUrl)return new NextResponse(null,{status:404});
 await db.from("fanlink_events").insert({fanlink_id:id,event_type:"preview_play"});
 return NextResponse.redirect(signed.signedUrl,302);
}
