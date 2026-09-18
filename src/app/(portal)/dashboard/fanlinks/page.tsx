import Link from "next/link";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

type FanlinkEvent = { event_type: string; platform: string | null };
type FanlinkRow = {
 id: string; title: string; artist_name: string; artist_slug: string; song_slug: string;
 resolution_status: string; preview_ready: boolean; platform_links: Record<string,string> | null;
 fanlink_events: FanlinkEvent[] | null;
};

export default async function FanlinksPage(){
 const ctx=await RequireRole(["artist","label"]); const db=await createClient();
 const {data}=await db.from("fanlinks").select("id,title,artist_name,artist_slug,song_slug,resolution_status,preview_ready,platform_links,fanlink_events(event_type,platform)").eq("owner_user_id",ctx.userId).order("updated_at",{ascending:false});
 const fanlinks=(data??[]) as FanlinkRow[];
 return <main className="space-y-5"><div><h1 className="text-h2">Fanlinks</h1><p className="text-small text-[var(--nexo-text-muted)]">Smart links are created for live Nexo releases and cached for reliable access.</p></div><div className="grid gap-4">{fanlinks.map((f)=>{const events=f.fanlink_events??[];const clicks=events.filter((e)=>e.event_type==="platform_click").length;return <article key={f.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{f.title}</h2><p className="text-caption text-[var(--nexo-text-muted)]">{f.artist_name}</p></div><span className="text-caption">{f.resolution_status}</span></div><div className="mt-3 flex flex-wrap gap-4 text-caption"><span>{Object.keys(f.platform_links??{}).length} stores</span><span>{clicks} DSP clicks</span><span>{events.filter((e)=>e.event_type==="view").length} views</span><span>{f.preview_ready?"30-sec preview ready":"Preview processing"}</span></div><div className="mt-4"><Link className="underline" href={"/"+f.artist_slug+"/"+f.song_slug} target="_blank">Open public Fanlink</Link></div></article>})}{!fanlinks.length?<p className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-5 text-small">No live-release Fanlinks yet.</p>:null}</div></main>;
}