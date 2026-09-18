"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { inviteStaffUserAction } from "@/app/admin/actions";

type TeamRole = {
  role_key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

type BaseRole = "support" | "admin" | "super_admin";

const BASE_ROLES: Array<{
  role: BaseRole;
  label: string;
  description: string;
}> = [
  {
    role: "support",
    label: "Team Staff",
    description:
      "Least-privilege staff account. Access comes only from the functional teams selected below.",
  },
  {
    role: "admin",
    label: "Administrator",
    description:
      "Full day-to-day Nexo administration. Administrator access can only be granted by a Super Admin.",
  },
  {
    role: "super_admin",
    label: "Super Admin",
    description:
      "Full access including administrator promotion and privileged role management.",
  },
];

export function StaffInviteForm({
  teamRoles,
  allowAdministratorLevel = false,
}: {
  teamRoles: TeamRole[];
  allowAdministratorLevel?: boolean;
}) {
  const router = useRouter();
  const defaultTeam =
    teamRoles.find((item) => item.role_key === "support")?.role_key ??
    teamRoles[0]?.role_key ??
    "";

  const [email, setEmail] = React.useState("");
  const [baseRole, setBaseRole] = React.useState<BaseRole>("support");
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>(
    defaultTeam ? [defaultTeam] : []
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const availableBaseRoles = allowAdministratorLevel
    ? BASE_ROLES
    : BASE_ROLES.filter((item) => item.role === "support");

  function toggleTeam(roleKey: string) {
    setSelectedTeams((current) =>
      current.includes(roleKey)
        ? current.filter((item) => item !== roleKey)
        : [...current, roleKey]
    );
  }

  return (
    <form
      className="mb-6 space-y-5 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(null);

        const result = await inviteStaffUserAction({
          email,
          baseRole,
          teamRoles: baseRole === "support" ? selectedTeams : [],
        });

        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        const teamNames = teamRoles
          .filter((item) => selectedTeams.includes(item.role_key))
          .map((item) => item.name);
        const access =
          baseRole === "support"
            ? teamNames.join(", ")
            : BASE_ROLES.find((item) => item.role === baseRole)?.label ?? baseRole;

        setOk(`Invitation sent to ${email} with ${access} access.`);
        setEmail("");
        setBaseRole("support");
        setSelectedTeams(defaultTeam ? [defaultTeam] : []);
        router.refresh();
      }}
    >
      <div>
        <h2 className="text-h4">Invite team member</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Assign one or multiple functional teams. The member only sees and can use the
          admin areas granted by those teams.
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
        onChange={(event) => setEmail(event.target.value)}
        placeholder="team@nexomusicdistribution.com"
      />

      {allowAdministratorLevel ? (
        <div className="space-y-2">
          <p className="text-caption font-medium text-[var(--nexo-text-muted)]">
            Account access level
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            {availableBaseRoles.map((item) => (
              <label
                key={item.role}
                className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="base-role"
                    value={item.role}
                    checked={baseRole === item.role}
                    onChange={() => setBaseRole(item.role)}
                  />
                  {item.label}
                </span>
                <span className="mt-1 block text-caption text-[var(--nexo-text-muted)]">
                  {item.description}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {baseRole === "support" ? (
        <div className="space-y-2">
          <div>
            <p className="text-caption font-medium text-[var(--nexo-text-muted)]">
              Functional team access
            </p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Select as many teams as this staff member actually needs.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {teamRoles.map((item) => (
              <label
                key={item.role_key}
                className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
              >
                <span className="flex items-start gap-2 font-medium">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={selectedTeams.includes(item.role_key)}
                    onChange={() => toggleTeam(item.role_key)}
                  />
                  <span>{item.name}</span>
                </span>
                <span className="mt-1 block text-caption text-[var(--nexo-text-muted)]">
                  {item.description}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <Alert title="Full administrative account">
          Functional team restrictions do not apply to Administrator or Super Admin accounts.
        </Alert>
      )}

      <Button
        type="submit"
        disabled={
          pending ||
          (baseRole === "support" && selectedTeams.length === 0)
        }
        aria-busy={pending}
      >
        {pending ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}
