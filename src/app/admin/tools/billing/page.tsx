import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { AccountPlanControl } from "@/components/admin/AccountPlanControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { listBillingToolUsers } from "@/lib/billing/admin-tools";
import { isTierId, type BillingAccountType } from "@/lib/billing/plans";
import type { AdminPlanStatus } from "@/lib/billing/admin-overrides";
import { getProviderConnectionState } from "@/lib/provider";
import { distributionReference } from "@/lib/provider/distribution-reference";
import { getDistributionCredentialMetadata } from "@/lib/provider/oauth/store";

export const metadata: Metadata = {
  title: "Billing tools",
  robots: { index: false, follow: false },
};

function providerIdentityLabel(value: unknown): string {
  const object =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const nested =
    object.data && typeof object.data === "object" && !Array.isArray(object.data)
      ? (object.data as Record<string, unknown>)
      : object;
  for (const key of ["display_name", "displayName", "name", "email", "id"]) {
    const candidate = nested[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number") return String(candidate);
  }
  return "Connected account";
}

function allowedAdminStatus(value: string | null | undefined): AdminPlanStatus | null {
  if (
    value === "active" ||
    value === "trialing" ||
    value === "past_due" ||
    value === "expired" ||
    value === "paused" ||
    value === "canceled"
  ) {
    return value;
  }
  return null;
}

export default async function AdminBillingToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; accountType?: string }>;
}) {
  await RequireAdminPermission("admin:billing_tools");
  const sp = await searchParams;
  const accountType: BillingAccountType | null =
    sp.accountType === "artist" || sp.accountType === "label"
      ? sp.accountType
      : null;

  const [usersResult, providerResult, credentialResult, identityResult, salesResult] =
    await Promise.allSettled([
      listBillingToolUsers({ q: sp.q ?? null, accountType }),
      getProviderConnectionState(),
      getDistributionCredentialMetadata(),
      distributionReference.me(),
      distributionReference.salesOverview({ page: 1, perPage: 1 }),
    ]);

  const users =
    usersResult.status === "fulfilled"
      ? usersResult.value
      : { rows: [], error: "Could not load billing users." };
  const provider =
    providerResult.status === "fulfilled" ? providerResult.value : null;
  const credential =
    credentialResult.status === "fulfilled" ? credentialResult.value : null;
  const providerIdentity =
    identityResult.status === "fulfilled"
      ? providerIdentityLabel(identityResult.value)
      : "Unavailable";
  const salesReady = salesResult.status === "fulfilled";

  return (
    <div>
      <PageHeader
        title="Billing tools"
        description="Manage Nexo artist and label plan access without rewriting Paddle subscription truth."
      />

      <Alert variant="default" title="Billing source of truth">
        Paddle remains the payment record. Manual changes here are separate Nexo entitlement overrides.
        TooLost is used only for live distribution / sales context and is not treated as the Nexo subscription processor.
      </Alert>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-small">TooLost connection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h4">{provider?.connected ? "Connected" : "Unavailable"}</p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              {provider?.message ?? "Provider status could not be loaded."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-small">Provider account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small font-medium">{providerIdentity}</p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Live response from the connected TooLost account.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-small">Sales / royalty API</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h4">{salesReady ? "Ready" : "Unavailable"}</p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Uses the protected sales overview endpoint; no generated earnings.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-small">OAuth token</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small">
              {credential?.verifiedAt ? "Verified" : "Not verified"}
            </p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              {credential?.expiresAt
                ? `Expires ${new Date(credential.expiresAt).toLocaleString()}`
                : "Expiry not reported"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/admin/finance/billing"
          className="rounded-full border border-[var(--nexo-border)] px-4 py-2 text-small"
        >
          View Paddle subscriptions
        </Link>
        <Link
          href="/admin/distribution/account"
          className="rounded-full border border-[var(--nexo-border)] px-4 py-2 text-small"
        >
          Open TooLost account
        </Link>
        <Link
          href="/admin/royalties"
          className="rounded-full border border-[var(--nexo-border)] px-4 py-2 text-small"
        >
          Open royalties
        </Link>
      </div>

      <form className="mt-8 flex flex-wrap gap-2 text-small" method="get">
        <select
          name="accountType"
          defaultValue={sp.accountType ?? ""}
          className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
          aria-label="Account type"
        >
          <option value="">Artists & labels</option>
          <option value="artist">Artist</option>
          <option value="label">Label</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, email or user ID"
          className="min-w-[18rem] flex-1 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-full border border-[var(--nexo-border)] px-4 py-2"
        >
          Search
        </button>
      </form>

      {users.error ? (
        <div className="mt-6">
          <ErrorState
            title="Billing tools unavailable"
            description={users.error}
            retryHref="/admin/tools/billing"
          />
        </div>
      ) : null}

      {!users.error && users.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No artist or label accounts found"
            description="Try a different name, email, user ID, or account type."
          />
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {users.rows.map((row) => {
          const paddlePlan =
            row.paddle?.plan_id && isTierId(row.paddle.plan_id)
              ? row.paddle.plan_id
              : null;
          const currentPlan = row.override?.plan_id ?? paddlePlan;
          const currentStatus =
            row.override?.status ?? allowedAdminStatus(row.paddle?.status);
          const currentInterval =
            row.override?.billing_interval ?? row.paddle?.interval ?? null;
          const currentEndsAt =
            row.override?.ends_at ?? row.paddle?.current_period_ends_at ?? null;

          return (
            <Card key={row.userId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{row.name || row.email || row.userId}</CardTitle>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {row.email ?? "No email"} · {row.accountType} · {row.userId}
                    </p>
                  </div>
                  <div className="text-right text-caption">
                    <p>
                      Effective: <strong>{row.effective.planId ?? "no paid plan"}</strong>
                    </p>
                    <p className="text-[var(--nexo-text-muted)]">
                      {row.effective.status ?? "no billing state"} · {row.effective.source}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-2 md:grid-cols-3">
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption uppercase text-[var(--nexo-text-muted)]">Paddle</p>
                    <p className="mt-1 text-small font-medium">
                      {row.paddle
                        ? `${row.paddle.plan_id ?? "unknown plan"} · ${row.paddle.status}`
                        : "No Paddle subscription"}
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {row.paddle?.interval ?? "—"}
                      {row.paddle?.current_period_ends_at
                        ? ` · ends ${new Date(row.paddle.current_period_ends_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption uppercase text-[var(--nexo-text-muted)]">Manual override</p>
                    <p className="mt-1 text-small font-medium">
                      {row.override
                        ? `${row.override.plan_id} · ${row.override.status}`
                        : "None"}
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {row.override?.billing_interval ?? "—"}
                      {row.override?.ends_at
                        ? ` · ends ${new Date(row.override.ends_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption uppercase text-[var(--nexo-text-muted)]">TooLost-linked catalog</p>
                    <p className="mt-1 text-small font-medium">
                      {row.providerReleaseCount} linked release
                      {row.providerReleaseCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      Counted from real Nexo ↔ provider release links.
                    </p>
                  </div>
                </div>

                <AccountPlanControl
                  userId={row.userId}
                  accountType={row.accountType}
                  currentPlanId={currentPlan}
                  currentStatus={currentStatus}
                  currentBillingInterval={currentInterval}
                  currentEndsAt={currentEndsAt}
                  hasOverride={Boolean(row.override)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
