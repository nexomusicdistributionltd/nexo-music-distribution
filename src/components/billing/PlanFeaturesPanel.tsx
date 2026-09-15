import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { getTier } from "@/lib/billing/plans";
import type { BillingEntitlements } from "@/lib/billing/entitlements";
import {
  availablePlanFeatures,
  lockedPlanFeatures,
  pricingHrefForAccount,
  type PlanFeature,
} from "@/lib/billing/feature-access";

function FeatureRow({
  feature,
  locked,
}: {
  feature: PlanFeature;
  locked?: boolean;
}) {
  const inner = (
    <>
      <span className="font-medium">{feature.label}</span>
      <span className="mt-0.5 block text-caption text-[var(--nexo-text-muted)]">
        {feature.description}
      </span>
    </>
  );
  const className = `block rounded-[var(--nexo-radius)] border px-3 py-2 text-small ${
    locked
      ? "border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/50 text-[var(--nexo-text-muted)]"
      : "border-[var(--nexo-border)] bg-[var(--nexo-surface)]"
  }`;
  if (feature.href && !locked) {
    return (
      <li>
        <Link href={feature.href} className={`${className} hover:bg-[var(--nexo-ghost-hover)]`}>
          {inner}
        </Link>
      </li>
    );
  }
  return <li className={className}>{inner}</li>;
}

export function PlanFeaturesPanel({ entitlements }: { entitlements: BillingEntitlements }) {
  const available = availablePlanFeatures(entitlements);
  const locked = lockedPlanFeatures(entitlements);
  const plan = entitlements.planId ? getTier(entitlements.planId) : null;
  const upgradeHref = pricingHrefForAccount(entitlements.accountType);
  const planLabel =
    plan?.name ??
    (entitlements.accountType === "label" ? "Label (grandfathered)" : "Artist Starter");

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-h4">Plan features</h3>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Access from verified billing state — not from the browser.
          </p>
        </div>
        <Badge>{planLabel}</Badge>
      </div>

      <p className="text-caption text-[var(--nexo-text-muted)]">{entitlements.policy}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-caption font-medium uppercase tracking-[0.08em] text-[var(--nexo-text-muted)]">
            Available
          </h4>
          <ul className="space-y-2">
            {available.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} />
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="text-caption font-medium uppercase tracking-[0.08em] text-[var(--nexo-text-muted)]">
            Locked
          </h4>
          {locked.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No locked Pro features on this plan.</p>
          ) : (
            <ul className="space-y-2">
              {locked.map((feature) => (
                <FeatureRow key={feature.id} feature={feature} locked />
              ))}
            </ul>
          )}
          {locked.length > 0 ? (
            <p className="pt-1 text-caption">
              <Link href={upgradeHref} className="underline-offset-4 hover:underline">
                Compare plans
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
