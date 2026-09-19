import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { toggleFeatureFlagAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Feature Flags", robots:{index:false,follow:false} };

export default async function FeatureFlagsPage() {
  await RequireAdminPermission("admin:settings");
  const supabase=await createClient();
  const {data:flags}=await supabase.from("admin_feature_flags").select("*").order("key");
  return <div className="space-y-6">
    <PageHeader title="Feature Flags & Maintenance" description="Operational switches are realtime and default to the current enabled behavior. Turning a flag off affects only the named feature." />
    <div className="grid gap-3 lg:grid-cols-2">{(flags??[]).map((flag)=><form key={flag.key} action={toggleFeatureFlagAction} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <input type="hidden" name="key" value={flag.key}/>
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{flag.label}</h2><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{flag.description}</p><p className="mt-2 font-mono text-[11px] text-[var(--nexo-text-muted)]">{flag.key}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${flag.enabled?"bg-emerald-600 text-white":"bg-red-600 text-white"}`}>{flag.enabled?"ON":"OFF"}</span></div>
      <input type="hidden" name="enabled" value={flag.enabled?"false":"true"}/>
      <Button type="submit" size="sm" variant={flag.enabled?"outline":"primary"} className="mt-4">{flag.enabled?"Turn off":"Turn on"}</Button>
    </form>)}</div>
  </div>;
}
