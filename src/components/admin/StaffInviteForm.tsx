"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { inviteStaffUserAction } from "@/app/admin/actions";
import type { AppRole } from "@/lib/auth/types";

const STAFF_ROLES: Array<{ role: AppRole; label: string; description: string }> = [
  {
    role: "support",
    label: "Support Staff",
    description:
      "Support tickets, contact messages, catalog lookup and QC. No finance, royalties, TooLost distribution, settings or staff management.",
  },
  {
    role: "admin",
    label: "Administrator",
    description:
      "Full day-to-day administration including users, finance, TooLost distribution, DDEX, website tools and settings. Can invite staff.",
  },
  {
    role: "super_admin",
    label: "Super Admin",
    description:
      "Full administrator access plus privileged role changes and Super Admin management.",
  },
];

export function StaffInviteForm({
  allowSuperAdmin = false,
}: {
  allowSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("support");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const availableRoles = allowSuperAdmin
    ? STAFF_ROLES
    : STAFF_ROLES.filter((item) => item.role !== "super_admin");

  return (
    <form
      className="mb-6 space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(null);
        const res = await inviteStaffUserAction({ email, roles: [role] });
        setPending(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const label = STAFF_ROLES.find((item) => item.role === role)?.label ?? role;
        setOk(`Invitation sent to ${email} with ${label} access.`);
        setEmail("");
        setRole("support");
        router.refresh();
      }}
    >
      <div>
        <h2 className="text-h4">Invite staff member</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Choose one access level. Permissions are enforced on the server, not only in the sidebar.
          {allowSuperAdmin
            ? " Super Admin access is available because you are a Super Admin."
            : " Only a Super Admin can grant Super Admin access."}
        </p>
      </div>

      {error ? (
        <Alert variant="warning" title="Invitation not sent">
          {error}
        </Alert>
      ) : null}
      {ok ? <Alert title="Invitation sent">{ok}</Alert> : null}

      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="team@nexomusicdistribution.com"
      />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {availableRoles.map((item) => (
          <label
            key={item.role}
            className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="staff-role"
                value={item.role}
                checked={role === item.role}
                onChange={() => setRole(item.role)}
              />
              {item.label}
            </span>
            <span className="mt-1 block text-caption text-[var(--nexo-text-muted)]">
              {item.description}
            </span>
          </label>
        ))}
      </div>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}
