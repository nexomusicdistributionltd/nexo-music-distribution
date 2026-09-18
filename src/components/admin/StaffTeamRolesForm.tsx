"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { setStaffTeamRolesAction } from "@/app/admin/actions";

type TeamRole = {
  role_key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export function StaffTeamRolesForm({
  userId,
  teamRoles,
  currentRoleKeys,
}: {
  userId: string;
  teamRoles: TeamRole[];
  currentRoleKeys: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>(currentRoleKeys);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  React.useEffect(() => {
    setSelected(currentRoleKeys);
  }, [currentRoleKeys]);

  function toggle(roleKey: string) {
    setSelected((current) =>
      current.includes(roleKey)
        ? current.filter((item) => item !== roleKey)
        : [...current, roleKey]
    );
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const result = await setStaffTeamRolesAction({
          userId,
          teamRoles: selected,
        });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOk(true);
        router.refresh();
      }}
    >
      <div>
        <p className="text-caption font-medium text-[var(--nexo-text-muted)]">
          Functional teams
        </p>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Access is the combined permission set from every selected team.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {teamRoles.map((item) => (
          <label
            key={item.role_key}
            className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-2.5"
          >
            <span className="flex items-start gap-2 text-small font-medium">
              <input
                className="mt-1"
                type="checkbox"
                checked={selected.includes(item.role_key)}
                onChange={() => toggle(item.role_key)}
              />
              <span>{item.name}</span>
            </span>
            <span className="mt-1 block text-caption text-[var(--nexo-text-muted)]">
              {item.description}
            </span>
          </label>
        ))}
      </div>

      {error ? (
        <Alert variant="warning" title="Team access not updated">
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Team access updated.
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save team access"}
      </Button>
    </form>
  );
}
