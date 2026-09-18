"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { setUserRolesAction } from "@/app/admin/actions";
import type { AppRole } from "@/lib/auth/types";

const STAFF_ACCESS: Array<{
  role: Extract<AppRole, "support" | "admin" | "super_admin">;
  label: string;
}> = [
  { role: "support", label: "Support Staff" },
  { role: "admin", label: "Administrator" },
  { role: "super_admin", label: "Super Admin" },
];

export function StaffRoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: Extract<AppRole, "support" | "admin" | "super_admin">;
}) {
  const router = useRouter();
  const [role, setRole] = React.useState(currentRole);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  React.useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || role === currentRole) return;
        setPending(true);
        setError(null);
        setOk(false);
        const result = await setUserRolesAction({ userId, roles: [role] });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOk(true);
        router.refresh();
      }}
    >
      <label className="min-w-56 space-y-1">
        <span className="block text-caption text-[var(--nexo-text-muted)]">
          Staff access level
        </span>
        <select
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value as Extract<AppRole, "support" | "admin" | "super_admin">
            )
          }
          className="h-10 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-3 text-small"
        >
          {STAFF_ACCESS.map((item) => (
            <option key={item.role} value={item.role}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" disabled={pending || role === currentRole}>
        {pending ? "Saving…" : "Update access"}
      </Button>
      {error ? (
        <div className="basis-full">
          <Alert variant="warning" title="Access not updated">
            {error}
          </Alert>
        </div>
      ) : null}
      {ok ? (
        <p className="basis-full text-caption text-[var(--nexo-text-muted)]">
          Access updated.
        </p>
      ) : null}
    </form>
  );
}
