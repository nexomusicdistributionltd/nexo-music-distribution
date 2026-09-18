import { NextRequest,NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
const safe=/^[a-z0-9_]{1,40}$/;
const hosts:Record<string,string[]>={spotify:["spotify.com"],apple_music:["music.apple.com"],youtube:["youtube.com","youtu.be"],youtube_music:["music.youtube.com"],deezer:["deezer.com"],tidal:["tidal.com"],soundcloud:["soundcloud.com"],amazon_music:["music.amazon.com"],audiomack:["audiomack.com"],pandora:["pandora.com"],shazam:["shazam.com"],tiktok:["tiktok.com"]};
function allowed(platform:string,raw:string){try{const u=new URL(raw);if(u.protocol!=="https:")return false;return (hosts[platform]??[]).some(h=>u.hostname===h||u.hostname.endsWith("."+h))}catch{return false}}
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string;platform:string}>}){
 const {id,platform}=await params;if(!safe.test(platform))return NextResponse.redirect(new URL("/",req.url));
 const db=createServiceClient();const {data}=await db.from("fanlinks").select("platform_links,is_published").eq("id",id).maybeSingle();
 const url=((data?.platform_links??{}) as Record<string,unknown>)[platform];
 if(!data?.is_published||typeof url!=="string"||!allowed(platform,url))return NextResponse.redirect(new URL("/",req.url));
 try{await db.from("fanlink_events").insert({fanlink_id:id,event_type:"platform_click",platform})}catch{}
 return NextResponse.redirect(url,302);
}
