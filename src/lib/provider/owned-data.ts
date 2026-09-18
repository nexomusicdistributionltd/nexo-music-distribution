import "server-only";
import { createClient } from "@/lib/supabase/server";
import { distributionReference } from "@/lib/provider/distribution-reference";
type Row=Record<string,unknown>;
function arr(x:unknown):Row[]{if(Array.isArray(x))return x.filter(v=>v&&typeof v==="object") as Row[];const o=(x&&typeof x==="object"?x:{}) as Row;for(const k of ["data","items","releases","tracks","artists","channels","territories","sales","analytics"]){if(Array.isArray(o[k]))return o[k] as Row[]}return []}
function ids(rows:Row[]){return new Set(rows.map(r=>String(r.provider_release_id??"")).filter(Boolean))}
export async function ownedDistributionScope(userId:string){
 const db=await createClient();const {data:local}=await db.from("releases").select("id,provider_release_id,artist_profile_id,label_profile_id").eq("owner_user_id",userId);
 return {local:local??[],providerIds:ids((local??[]) as unknown as Row[])};
}
export async function ownedSales(userId:string,kind:"overview"|"tracks"|"releases"|"artists"|"channels"|"territories"|"streamRates"){
 const scope=await ownedDistributionScope(userId);if(!scope.providerIds.size)return [];
 const raw=await ({overview:distributionReference.salesOverview,tracks:distributionReference.salesTracks,releases:distributionReference.salesReleases,artists:distributionReference.salesArtists,channels:distributionReference.salesChannels,territories:distributionReference.salesTerritories,streamRates:distributionReference.streamRates}[kind])();
 return arr(raw).filter(r=>{const id=String(r.release_id??r.releaseId??r.provider_release_id??"");return Boolean(id)&&scope.providerIds.has(id)});
}
export async function ownedAnalytics(userId:string){
 const scope=await ownedDistributionScope(userId);if(!scope.providerIds.size)return [];
 const raw=await distributionReference.analytics();return arr(raw).filter(r=>{const id=String(r.release_id??r.releaseId??r.provider_release_id??"");return Boolean(id)&&scope.providerIds.has(id)});
}
