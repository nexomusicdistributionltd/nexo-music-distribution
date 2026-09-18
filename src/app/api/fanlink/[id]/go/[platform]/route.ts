import { NextRequest,NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
const safe=/^[a-z0-9_]{1,40}$/;
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string;platform:string}>}){
 const {id,platform}=await params;if(!safe.test(platform))return NextResponse.redirect(new URL("/",req.url));
 const db=createServiceClient();const {data}=await db.from("fanlinks").select("platform_links,is_published").eq("id",id).maybeSingle();
 const url=((data?.platform_links??{}) as Record<string,unknown>)[platform];
 if(!data?.is_published||typeof url!=="string"||!url.startsWith("https://"))return NextResponse.redirect(new URL("/",req.url));
 await db.from("fanlink_events").insert({fanlink_id:id,event_type:"platform_click",platform});
 return NextResponse.redirect(url,302);
}
