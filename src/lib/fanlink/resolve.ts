import "server-only";

export type FanlinkResult = {
  title: string | null;
  artist: string | null;
  isrc: string | null;
  artwork: string | null;
  links: Record<string, string>;
};

function cleanLinks(value: unknown): Record<string,string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string,unknown>)
    .filter(([,v]) => typeof v === "string" && /^https:\/\//i.test(v as string))
    .map(([k,v]) => [k, v as string]));
}

export async function resolveFanlink(input: string): Promise<FanlinkResult> {
  const q=input.trim();
  if (!q) throw new Error("A music URL or ISRC is required.");
  const musicKey=(process.env.MUSICLINK_API_KEY??"").trim();
  if (musicKey) {
    try {
      const res=await fetch(`https://api.ml.jadquir.com/v1/lookup?q=${encodeURIComponent(q)}`,{
        headers:{Authorization:`Bearer ${musicKey}`,Accept:"application/json"},
        cache:"no-store",
      });
      if (res.ok) {
        const body=await res.json() as {data?:Array<Record<string,unknown>>};
        const row=body.data?.[0];
        if (row) return {
          title: typeof row.title==="string"?row.title:null,
          artist: typeof row.artist==="string"?row.artist:null,
          isrc: typeof row.isrc==="string"?row.isrc:null,
          artwork: typeof row.image_url==="string"?row.image_url:null,
          links: cleanLinks(row.links),
        };
      }
    } catch { /* fall through */ }
  }
  const songportKey=(process.env.SONGPORT_API_KEY??"").trim();
  if (songportKey && /^https:\/\//i.test(q)) {
    const res=await fetch("https://api.songport.link/v1/convert",{
      method:"POST",
      headers:{Authorization:`Bearer ${songportKey}`,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({url:q}),
      cache:"no-store",
    });
    if (res.ok) {
      const row=await res.json() as Record<string,unknown>;
      return {
        title: typeof row.title==="string"?row.title:null,
        artist: typeof row.artist==="string"?row.artist:null,
        isrc: typeof row.isrc==="string"?row.isrc:null,
        artwork: typeof row.artwork==="string"?row.artwork:null,
        links: cleanLinks(row.links ?? row.platforms),
      };
    }
  }
  throw new Error("Fanlink could not be resolved. Check the input or API configuration.");
}
