import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  const ctx = await RequireAuth();
  const isStaff = ctx.roles.includes("support") || ctx.roles.includes("admin") || ctx.roles.includes("super_admin");

  return (
    <div className="space-y-4">
      <h1 className="text-h2">{isStaff ? "Support desk" : "Support"}</h1>
      <Alert>
        Ticket workflows are not connected yet. For public inquiries, use{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Contact
        </Link>
        .
      </Alert>
      <ComingSoonPanel
        title={isStaff ? "No tickets in queue" : "Support inbox coming soon"}
        description="Authenticated support shell is ready. Messaging and ticket APIs arrive in a later batch."
      />
      {!isStaff ? (
        <Link href="/contact">
          <Button variant="outline" className="rounded-full">
            Public contact form
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
