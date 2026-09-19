import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { updateStoreCapabilityAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Store Capability Matrix", robots:{index:false,follow:false} };

export default async function StoresPage() {
  await RequireAdminPermission("admin:distribution");
  const supabase=await createClient();
  const {data:rows}=await supabase.from("distribution_store_capabilities").select("*").order("display_name");
  return <div className="space-y-6"><PageHeader title="DSP / Store Capability Matrix" description="Admin-maintained operational availability and restrictions. Unknown values remain explicitly unknown rather than being guessed."/>
    <div className="grid gap-4 xl:grid-cols-2">{(rows??[]).map((row)=><form key={row.store_key} action={updateStoreCapabilityAction} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"><input type="hidden" name="store_key" value={row.store_key}/><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{row.display_name}</h2><span className="text-caption text-[var(--nexo-text-muted)]">{row.operational_status}</span></div><Select name="operational_status" defaultValue={row.operational_status} className="mt-3">{["unknown","available","limited","approval_required","disabled"].map((x)=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</Select><div className="mt-3 flex flex-wrap gap-4 text-caption"><label><input type="checkbox" name="audio_supported" defaultChecked={row.audio_supported===true}/> Audio</label><label><input type="checkbox" name="video_supported" defaultChecked={row.video_supported===true}/> Video</label><label><input type="checkbox" name="atmos_supported" defaultChecked={row.atmos_supported===true}/> Atmos</label></div><Textarea name="restrictions" className="mt-3 font-mono text-caption" defaultValue={JSON.stringify(row.restrictions??{},null,2)} /><Textarea name="notes" className="mt-3" defaultValue={row.notes??""} placeholder="Operational notes"/><Button type="submit" size="sm" className="mt-3">Save store</Button></form>)}</div>
  </div>;
}
