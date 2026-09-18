"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setAccountPlanOverrideAction } from "@/app/admin/actions";
import type { BillingAccountType, TierId } from "@/lib/billing/plans";

type PlanStatus = "active" | "trialing" | "expired" | "paused" | "canceled";

const ARTIST_PLANS = ["artist_starter", "artist_pro"] as const satisfies readonly TierId[];
const LABEL_PLANS = ["label_starter", "label_pro"] as const satisfies readonly TierId[];
const PLAN_STATUSES = ["active", "trialing", "expired", "paused", "canceled"] as const satisfies readonly PlanStatus[];

function isTierIdForAccount(
  value: string,
  accountType: BillingAccountType
): value is TierId {
  return accountType === "artist"
    ? value === "artist_starter" || value === "artist_pro"
    : value === "label_starter" || value === "label_pro";
}

function isPlanStatus(value: string): value is PlanStatus {
  return PLAN_STATUSES.some((status) => status === value);
}

export function AccountPlanControl({
  userId,
  accountType,
}: {
  userId: string;
  accountType: BillingAccountType;
}) {
  const router = useRouter();
  const plans: readonly TierId[] = accountType === "artist" ? ARTIST_PLANS : LABEL_PLANS;
  const [plan, setPlan] = React.useState<TierId>(plans[0]);
  const [status, setStatus] = React.useState<PlanStatus>("active");
  const [endsAt, setEndsAt] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMsg("");
        const result = await setAccountPlanOverrideAction({
          userId,
          accountType,
          planId: plan,
          status,
          endsAt: endsAt || null,
          reason,
        });
        setPending(false);
        setMsg(result.ok ? "Plan updated immediately." : result.error);
        if (result.ok) router.refresh();
      }}
    >
      <select
        value={plan}
        onChange={(event) => {
          if (isTierIdForAccount(event.target.value, accountType)) {
            setPlan(event.target.value);
          }
        }}
        className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1"
      >
        {plans.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <select
        value={status}
        onChange={(event) => {
          if (isPlanStatus(event.target.value)) setStatus(event.target.value);
        }}
        className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1"
      >
        {PLAN_STATUSES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={endsAt}
        onChange={(event) => setEndsAt(event.target.value)}
        aria-label="Plan access ends at"
        className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1"
      />
      <input
        type="text"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        maxLength={300}
        className="min-w-[12rem] rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Apply plan"}
      </Button>
      {msg ? <span className="text-caption">{msg}</span> : null}
    </form>
  );
}
