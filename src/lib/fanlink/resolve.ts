import "server-only";
export type FanlinkResult={title:string|null;artist:string|null;isrc:string|null;artwork:string|null;links:Record<string,string>};
function directLinks(value:unknown){if(!value||typeof value!=="object")return {};const out:Record<string,string>={};for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(typeof v==="string"&&/^https:\/\//i.test(v))out[k]=v;else if(v&&typeof v==="object"){const x=v as {url?:unknown,isSearchFallback?:unknown};if(typeof x.url==="string"&&/^https:\/\//i.test(x.url)&&x.isSearchFallback!==true)out[k.replace(/[A-Z]/g,m=>"_"+m.toLowerCase())]=x.url}}return out}
export async function resolveFanlink(input:string):Promise<FanlinkResult>{
 const q=input.trim();if(!q)throw new Error("A music URL or ISRC is required.");
 const mk=(process.env.MUSICLINK_API_KEY??"").trim();
 if(mk){try{const r=await fetch(`https://api.ml.jadquir.com/v1/lookup?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${mk}`,Accept:"application/json"},cache:"no-store"});if(r.ok){const b=await r.json() as {success?:boolean,data?:Array<Record<string,unknown>>};const x=b.data?.[0];if(x)return{title:typeof x.title==="string"?x.title:null,artist:typeof x.artist==="string"?x.artist:null,isrc:typeof x.isrc==="string"?x.isrc:null,artwork:typeof x.image_url==="string"?x.image_url:null,links:directLinks(x.links)}}}catch{}}
 // SongPort accepts a music URL, not a bare ISRC. It is a fallback only when the caller supplied a URL.
 const sk=(process.env.SONGPORT_API_KEY??"").trim();
 if(sk&&/^https:\/\//i.test(q)){const r=await fetch("https://api.songport.link/v1/convert",{method:"POST",headers:{Authorization:`Bearer ${sk}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({url:q}),cache:"no-store"});if(r.ok){const x=await r.json() as Record<string,unknown>;return{title:typeof x.title==="string"?x.title:null,artist:typeof x.artist==="string"?x.artist:null,isrc:typeof x.isrc==="string"?x.isrc:null,artwork:typeof x.thumbnail==="string"?x.thumbnail:null,links:directLinks(x.platforms)}}}
 throw new Error("Fanlink could not be resolved.");
}
