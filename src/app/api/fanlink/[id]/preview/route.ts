import { NextRequest,NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=createServiceClient();
 const {data:f}=await db.from("fanlinks").select("release_id,track_id,is_published").eq("id",id).maybeSingle();
 if(!f?.is_published||!f.release_id)return new NextResponse(null,{status:404});
 let q=db.from("release_assets").select("storage_bucket,storage_path").eq("release_id",f.release_id).eq("kind","audio");
 if(f.track_id)q=q.eq("track_id",f.track_id);
 let {data:a}=await q.limit(1).maybeSingle();
 if(!a&&f.track_id){const x=await db.from("release_assets").select("storage_bucket,storage_path").eq("release_id",f.release_id).eq("kind","audio").is("track_id",null).limit(1).maybeSingle();a=x.data}
 if(!a||a.storage_bucket!=="release-audio")return new NextResponse(null,{status:404});
 const {data:signed,error}=await db.storage.from(a.storage_bucket).createSignedUrl(a.storage_path,60);
 if(error||!signed?.signedUrl)return new NextResponse(null,{status:404});
 await db.from("fanlink_events").insert({fanlink_id:id,event_type:"preview_play"});
 return NextResponse.redirect(signed.signedUrl,302);
}
