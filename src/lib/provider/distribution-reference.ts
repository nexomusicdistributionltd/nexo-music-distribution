import "server-only";
import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";
import { ProviderUnavailableError } from "./errors";
type Json=Record<string,unknown>;
async function api(path:string){const token=await loadDistributionAccessToken();if(!token)throw new ProviderUnavailableError("Distribution Engine authorization is unavailable.");const c=readDistributionOAuthConfig();const r=await fetch(c.apiBaseUrl.replace(/\/$/,"")+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store"});if(!r.ok)throw new ProviderUnavailableError(`Distribution Engine request failed (HTTP ${r.status}).`);return r.json()}
function rows(x:unknown){const o=(x&&typeof x==="object"?x:{}) as Json;const d=(o.data&&typeof o.data==="object"?o.data:o) as Json;for(const k of ["releases","tracks","artists","channels","territories","platforms","countries","genres","languages","analytics","sales"]){if(Array.isArray(d[k]))return d[k] as unknown[]}return Array.isArray(o.data)?o.data as unknown[]:[]}
export const distributionReference={
 me:()=>api("/me"), releases:()=>api("/releases"), release:(id:string)=>api("/releases/"+encodeURIComponent(id)),
 releaseTracks:(id:string)=>api("/releases/"+encodeURIComponent(id)+"/tracks"),
 countries:()=>api("/countries"), platforms:()=>api("/platforms"), genres:()=>api("/genres"), languages:()=>api("/languages"),
 salesOverview:()=>api("/sales/overview"), salesTracks:()=>api("/sales/tracks"), salesReleases:()=>api("/sales/releases"),
 salesArtists:()=>api("/sales/artists"), salesChannels:()=>api("/sales/channels"), salesTerritories:()=>api("/sales/territories"),
 streamRates:()=>api("/sales/stream-rates"), analytics:()=>api("/analytics"), preferences:()=>api("/preferences"),
};
export async function distributionDashboardData(){
 const [releases,platforms,countries,genres,languages]=await Promise.allSettled([distributionReference.releases(),distributionReference.platforms(),distributionReference.countries(),distributionReference.genres(),distributionReference.languages()]);
 const value=(r:PromiseSettledResult<unknown>)=>r.status==="fulfilled"?rows(r.value):[];
 return {releases:value(releases),platforms:value(platforms),countries:value(countries),genres:value(genres),languages:value(languages)};
}
