"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { inviteStaffUserAction } from "@/app/admin/actions";
import type { AppRole } from "@/lib/auth/types";

const STAFF_ROLES: Array<{ role: AppRole; label: string; description: string }> = [
  { role: "support", label: "Support / Operations", description: "Support, QC, catalog review and operational tools." },
  { role: "admin", label: "Administrator", description: "Operational administration including users, finance, settings and distribution." },
  { role: "super_admin", label: "Super Admin", description: "Full administration including role management. Assign sparingly." },
];

export function StaffInviteForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [roles, setRoles] = React.useState<AppRole[]>(["support"]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  function toggle(role: AppRole) {
    setRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  return (
    <form className="mb-6 space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5" onSubmit={async (e) => {
      e.preventDefault();
      if (pending) return;
      setPending(true); setError(null); setOk(null);
      const res = await inviteStaffUserAction({ email, roles });
      setPending(false);
      if (!res.ok) { setError(res.error); return; }
      setOk(`Invitation sent to ${email}. Access roles are already assigned.`);
      setEmail(""); setRoles(["support"]); router.refresh();
    }}>
      <div><h2 className="text-h4">Invite admin team member</h2><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Super Admin can invite staff and assign controlled access before their first login.</p></div>
      {error ? <Alert variant="warning" title="Invitation not sent">{error}</Alert> : null}
      {ok ? <Alert title="Invitation sent">{ok}</Alert> : null}
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="team@nexomusicdistribution.com" />
      <div className="grid gap-2 md:grid-cols-3">{STAFF_ROLES.map((item) => <label key={item.role} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"><span className="flex items-center gap-2 font-medium"><input type="checkbox" checked={roles.includes(item.role)} onChange={() => toggle(item.role)} />{item.label}</span><span className="mt-1 block text-caption text-[var(--nexo-text-muted)]">{item.description}</span></label>)}</div>
      <Button type="submit" disabled={pending || !roles.length} aria-busy={pending}>{pending ? "Sending invitation…" : "Send invitation"}</Button>
    </form>
  );
}
