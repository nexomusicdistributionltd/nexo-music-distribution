import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate=60;

const LABELS:Record<string,string>={spotify:"Spotify",apple_music:"Apple Music",youtube:"YouTube",youtube_music:"YouTube Music",deezer:"Deezer",tidal:"TIDAL",soundcloud:"SoundCloud",amazon_music:"Amazon Music",qobuz:"Qobuz",pandora:"Pandora",anghami:"Anghami",audiomack:"Audiomack",boomplay:"Boomplay",shazam:"Shazam",jiosaavn:"JioSaavn",napster:"Napster",yandex:"Yandex Music"};

export default async function PublicFanlinkPage({params}:{params:Promise<{artist:string;song:string}>}){
 const {artist,song}=await params; const db=createServiceClient();
 const {data}=await db.from("fanlinks").select("*").eq("artist_slug",artist).eq("song_slug",song).maybeSingle();
 if(!data) notFound();
 const links=Object.entries((data.platform_links??{}) as Record<string,string>).filter(([k,v])=>k!=="musiclink"&&typeof v==="string"&&v.startsWith("https://"));
 return <main className="min-h-screen bg-black text-white">
  <div className="mx-auto max-w-xl px-5 py-10">
   <header className="mb-8 flex items-center justify-center"><img src="/brand/nexo-logo-light.png" alt="Nexo Music Distribution" className="h-9 w-auto" /></header>
   <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl">
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[.035]"><span className="-rotate-12 text-5xl font-black tracking-widest">NEXO MUSIC</span></div>
    {data.artwork_url?<img src={data.artwork_url} alt="" className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover" />:null}
    <h1 className="mt-5 text-2xl font-semibold">{data.title}</h1><p className="mt-1 text-white/65">{data.artist_name}</p>
    {data.preview_storage_path?<audio controls preload="metadata" className="mt-5 w-full"><source src={`/api/fanlink/${data.id}/preview`} /></audio>:null}
    <div className="mt-6 grid gap-3">{links.map(([key,url])=><a key={key} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-medium transition hover:bg-white/15"><span>{LABELS[key]??key.replaceAll("_"," ")}</span><span aria-hidden>↗</span></a>)}</div>
   </section>
   <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/50"><span>Powered by Nexo Music Distribution LTD</span><span>•</span><button type="button">Share</button></div>
  </div>
 </main>;
}
