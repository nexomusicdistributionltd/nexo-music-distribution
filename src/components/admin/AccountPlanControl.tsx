"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  clearAccountPlanOverrideAction,
  setAccountPlanOverrideAction,
} from "@/app/admin/actions";
import type { BillingAccountType, BillingInterval, TierId } from "@/lib/billing/plans";

type AdminPlanStatus = "active" | "trialing" | "past_due" | "expired" | "paused" | "canceled";

const ARTIST_PLANS = ["artist_starter", "artist_pro"] as const satisfies readonly TierId[];
const LABEL_PLANS = ["label_starter", "label_pro"] as const satisfies readonly TierId[];
const PLAN_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "expired",
  "paused",
  "canceled",
] as const satisfies readonly AdminPlanStatus[];

function isTierIdForAccount(
  value: string,
  accountType: BillingAccountType
): value is TierId {
  return accountType === "artist"
    ? value === "artist_starter" || value === "artist_pro"
    : value === "label_starter" || value === "label_pro";
}

function isPlanStatus(value: string): value is AdminPlanStatus {
  return PLAN_STATUSES.some((status) => status === value);
}

function isBillingInterval(value: string): value is BillingInterval {
  return value === "month" || value === "year";
}

function statusLabel(status: AdminPlanStatus): string {
  if (status === "past_due") return "Unpaid / past due";
  return status.replace(/_/g, " ");
}

export function AccountPlanControl({
  userId,
  accountType,
  currentPlanId,
  currentStatus,
  currentBillingInterval,
  currentEndsAt,
  hasOverride = false,
}: {
  userId: string;
  accountType: BillingAccountType;
  currentPlanId?: TierId | null;
  currentStatus?: AdminPlanStatus | null;
  currentBillingInterval?: BillingInterval | null;
  currentEndsAt?: string | null;
  hasOverride?: boolean;
}) {
  const router = useRouter();
  const plans: readonly TierId[] = accountType === "artist" ? ARTIST_PLANS : LABEL_PLANS;
  const initialPlan =
    currentPlanId && isTierIdForAccount(currentPlanId, accountType)
      ? currentPlanId
      : plans[0];

  const [plan, setPlan] = React.useState<TierId>(initialPlan);
  const [status, setStatus] = React.useState<AdminPlanStatus>(currentStatus ?? "active");
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>(
    currentBillingInterval ?? "month"
  );
  const [endsAt, setEndsAt] = React.useState(currentEndsAt?.slice(0, 16) ?? "");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const paidPlan = plan !== "artist_starter";

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMsg("");
        const result = await setAccountPlanOverrideAction({
          userId,
          accountType,
          planId: plan,
          billingInterval: paidPlan ? billingInterval : null,
          status,
          endsAt: endsAt || null,
          reason,
        });
        setPending(false);
        if (result.ok) {
          const expiry =
            result.data &&
            typeof result.data === "object" &&
            "endsAt" in result.data &&
            typeof result.data.endsAt === "string"
              ? new Date(result.data.endsAt).toLocaleDateString()
              : null;
          setMsg(expiry ? `Plan updated. Access ends ${expiry}.` : "Plan updated immediately.");
          router.refresh();
        } else {
          setMsg(result.error);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={plan}
          onChange={(event) => {
            if (isTierIdForAccount(event.target.value, accountType)) {
              setPlan(event.target.value);
            }
          }}
          className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-2 text-small"
          aria-label="Plan"
        >
          {plans.map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          value={billingInterval}
          onChange={(event) => {
            if (isBillingInterval(event.target.value)) setBillingInterval(event.target.value);
          }}
          disabled={!paidPlan}
          className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-2 text-small disabled:opacity-50"
          aria-label="Billing interval"
        >
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </select>

        <select
          value={status}
          onChange={(event) => {
            if (isPlanStatus(event.target.value)) setStatus(event.target.value);
          }}
          className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-2 text-small"
          aria-label="Billing status"
        >
          {PLAN_STATUSES.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          aria-label="Plan access ends at"
          className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-2 text-small"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason / internal note"
          maxLength={300}
          className="min-w-[14rem] flex-1 rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-2 text-small"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Apply billing state"}
        </Button>
        {hasOverride ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setMsg("");
              const result = await clearAccountPlanOverrideAction({
                userId,
                reason: reason || "Returned to Paddle billing truth",
              });
              setPending(false);
              setMsg(result.ok ? "Manual override removed. Paddle/default access restored." : result.error);
              if (result.ok) router.refresh();
            }}
            className="rounded-full border border-[var(--nexo-border)] px-4 py-2 text-small disabled:opacity-50"
          >
            Reset to Paddle
          </button>
        ) : null}
      </div>

      <p className="text-caption text-[var(--nexo-text-muted)]">
        Leave the end date blank to grant one full selected interval from now. “Unpaid / past due” disables paid access without changing Paddle records.
      </p>
      {msg ? <p className="text-caption">{msg}</p> : null}
    </form>
  );
}
