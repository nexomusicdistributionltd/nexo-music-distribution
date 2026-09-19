import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { revokeUserOtpSessionsAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"User Security", robots:{index:false,follow:false} };

export default async function SecurityPage() {
  await RequireAdminPermission("admin:users");
  const supabase=await createClient();
  const [{data:sessions},{data:events}]=await Promise.all([
    supabase.from("login_otp_verified_sessions").select("id,user_id,session_id,verified_at").order("verified_at",{ascending:false}).limit(100),
    supabase.from("audit_logs").select("id,actor_user_id,action,ip_address,user_agent,created_at").in("action",["login","logout","login_password_success","otp_failed","otp_verified","otp_expired"]).order("created_at",{ascending:false}).limit(100),
  ]);
  return <div className="space-y-6">
    <PageHeader title="User Security Center" description="Recent authentication activity, OTP-verified sessions and investigation controls. Session revocation does not alter catalog or royalty data." />
    <form action={revokeUserOtpSessionsAction} className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 sm:grid-cols-[1fr_1fr_auto]">
      <Input name="user_id" required placeholder="User UUID" />
      <Input name="reason" placeholder="Reason for revocation" />
      <Button type="submit">Revoke verified sessions</Button>
    </form>
    <section><h2 className="mb-3 text-h4">Verified sessions</h2>
      <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        <table className="min-w-full text-left text-small"><thead><tr className="border-b border-[var(--nexo-border)]"><th className="p-3">User</th><th className="p-3">Session</th><th className="p-3">Verified</th></tr></thead>
        <tbody>{(sessions??[]).map((row)=><tr key={row.id} className="border-b border-[var(--nexo-divider)]"><td className="p-3 font-mono text-caption">{row.user_id}</td><td className="p-3 font-mono text-caption">{row.session_id}</td><td className="p-3">{new Date(row.verified_at).toLocaleString()}</td></tr>)}</tbody></table>
      </div>
    </section>
    <section><h2 className="mb-3 text-h4">Recent authentication events</h2>
      <ul className="space-y-2">{(events??[]).map((row)=><li key={row.id} className="rounded border border-[var(--nexo-border)] p-3 text-small"><span className="font-medium">{row.action}</span> · {new Date(row.created_at).toLocaleString()}<span className="block font-mono text-caption text-[var(--nexo-text-muted)]">{row.actor_user_id??"unknown"} · {row.ip_address??"no IP"}</span></li>)}</ul>
    </section>
    <OpsCaseCenter caseType="security_review" createLabel="Open security review" />
  </div>;
}
