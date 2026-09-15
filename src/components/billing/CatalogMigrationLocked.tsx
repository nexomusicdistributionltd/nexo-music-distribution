import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { BillingAccountType } from "@/lib/billing/plans";
import { catalogMigrationUpgradePlan, pricingHrefForAccount } from "@/lib/billing/feature-access";
import { getTier } from "@/lib/billing/plans";

export function CatalogMigrationLocked({
  accountType,
}: {
  accountType: BillingAccountType | null;
}) {
  const plan = getTier(catalogMigrationUpgradePlan(accountType));
  return (
    <Alert variant="warning" title="Catalog migration is a Pro feature">
      <p>
        Move In stays locked until a verified {plan?.name ?? "Pro"} subscription is active. Completing
        checkout in the browser is not enough on its own.
      </p>
      <p className="mt-3">
        <Link href={pricingHrefForAccount(accountType)}>
          <Button className="rounded-full">View plans</Button>
        </Link>
      </p>
    </Alert>
  );
}
