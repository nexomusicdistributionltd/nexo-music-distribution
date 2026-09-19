import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { createAnnouncementAction, setAnnouncementActiveAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Broadcasts", robots:{index:false,follow:false} };

export default async function BroadcastsPage() {
  await RequireAdminPermission("admin:notifications");
  const supabase=await createClient();
  const {data:rows}=await supabase.from("admin_announcements").select("*").order("created_at",{ascending:false}).limit(100);
  return <div className="space-y-6">
    <PageHeader title="Broadcast & Announcement Center" description="Publish realtime dashboard notices to everyone, account groups, plan groups, countries or a specific user." />
    <details open className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"><summary className="cursor-pointer font-semibold">New announcement</summary>
      <form action={createAnnouncementAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input name="title" required placeholder="Announcement title"/>
        <Select name="severity" defaultValue="info"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="critical">Critical</option></Select>
        <Select name="audience" defaultValue="all"><option value="all">Everyone</option><option value="artists">All artists</option><option value="labels">All labels</option><option value="paid_artists">Paid artists</option><option value="free_artists">Free artists</option><option value="paid_labels">Paid labels</option><option value="free_labels">Free labels</option><option value="specific_user">Specific user</option><option value="country">Country</option></Select>
        <Input name="target_user_id" placeholder="Specific user UUID (when used)"/>
        <Input name="country_code" placeholder="Country value / code (when used)"/>
        <Input name="ends_at" type="datetime-local"/>
        <Textarea name="body" required placeholder="Announcement message" className="sm:col-span-2"/>
        <div className="sm:col-span-2"><Button type="submit">Publish announcement</Button></div>
      </form>
    </details>
    <div className="space-y-3">{(rows??[]).map((row)=><article key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{row.audience} · {row.severity}</p><h2 className="mt-1 font-semibold">{row.title}</h2><p className="mt-2 whitespace-pre-wrap text-small text-[var(--nexo-text-secondary)]">{row.body}</p><p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{new Date(row.starts_at).toLocaleString()}{row.ends_at?` → ${new Date(row.ends_at).toLocaleString()}`:""}</p></div><form action={setAnnouncementActiveAction}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="active" value={row.active?"false":"true"}/><Button size="sm" variant="outline" type="submit">{row.active?"Deactivate":"Activate"}</Button></form></div></article>)}</div>
  </div>;
}
