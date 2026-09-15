import type { Metadata } from "next";
import Link from "next/link";
import { RequireRole } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { BillingSyncRefresh } from "@/components/billing/BillingSyncRefresh";

export const metadata: Metadata = {
  title: "Checkout confirmation",
  robots: { index: false, follow: false },
};

export default async function BillingSuccessPage() {
  await RequireRole(["artist", "label"]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BillingSyncRefresh />
      <h1 className="text-h2">Thanks — confirmation is pending</h1>
      <Alert title="Access is not granted from this page">
        Paddle is confirming your payment. Paid access is applied only after a verified webhook
        updates your subscription. Refresh Plan & billing in a moment; do not assume checkout
        success in the browser means the plan is active.
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Link href="/billing">
          <Button className="rounded-full">View billing</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="rounded-full">
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
