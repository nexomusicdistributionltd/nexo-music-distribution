import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolveFanlink } from "./resolve";

export function fanlinkSlug(value:string){
 return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"music";
}

export async function refreshFanlinkForRelease(releaseId:string){
 const db=createServiceClient();
 const {data:release,error}=await db.from("releases").select("id,owner_user_id,title,primary_artist_name,status").eq("id",releaseId).single();
 if(error||!release) throw new Error("Release not found.");
 const {data:track}=await db.from("release_tracks").select("id,isrc").eq("release_id",releaseId).order("track_number").limit(1).maybeSingle();
 if(!track?.isrc) throw new Error("An ISRC is required before a fanlink can be resolved.");
 const resolved=await resolveFanlink(track.isrc);
 const artistSlug=fanlinkSlug(release.primary_artist_name);
 const songSlug=fanlinkSlug(release.title);
 const now=new Date().toISOString();
 const {data,error:saveError}=await db.from("fanlinks").upsert({
   owner_user_id:release.owner_user_id,release_id:release.id,track_id:track.id,
   slug:`${artistSlug}/${songSlug}`,artist_slug:artistSlug,song_slug:songSlug,
   title:resolved.title||release.title,artist_name:resolved.artist||release.primary_artist_name,
   isrc:resolved.isrc||track.isrc,artwork_url:resolved.artwork,platform_links:resolved.links,
   resolution_status:Object.keys(resolved.links).length?"resolved":"partial",resolved_at:now,last_refresh_at:now
 },{onConflict:"release_id"}).select("id,artist_slug,song_slug").single();
 if(saveError) throw new Error(saveError.message);
 return data;
}
