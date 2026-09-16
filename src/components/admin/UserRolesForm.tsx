"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { setUserRolesAction } from "@/app/admin/actions";
import { ASSIGNABLE_ROLES } from "@/lib/admin/roles";
import type { AppRole } from "@/lib/auth/types";

export function UserRolesForm({
  userId,
  currentRoles,
}: {
  userId: string;
  currentRoles: AppRole[];
}) {
  const router = useRouter();
  const [roles, setRoles] = React.useState<AppRole[]>(currentRoles);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  function toggle(role: AppRole) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  return (
    <form
      className="space-y-2 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const res = await setUserRolesAction({ userId, roles });
        setPending(false);
        if (!res.ok) setError(res.error);
        else {
          setOk(true);
          router.refresh();
        }
      }}
    >
      <p className="text-caption font-medium text-[var(--nexo-text-muted)]">Roles</p>
      <div className="flex flex-wrap gap-2">
        {ASSIGNABLE_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-caption">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => toggle(role)}
            />
            {role.replace(/_/g, " ")}
          </label>
        ))}
      </div>
      {error ? (
        <Alert variant="warning" title="Roles not updated">
          {error}
        </Alert>
      ) : null}
      {ok ? <p className="text-caption text-[var(--nexo-text-muted)]">Roles saved.</p> : null}
      <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save roles"}
      </Button>
    </form>
  );
}
