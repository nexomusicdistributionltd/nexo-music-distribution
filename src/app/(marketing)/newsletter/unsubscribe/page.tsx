import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isUnsubscribeTokenShape } from "@/lib/newsletter/email";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let state: "ok" | "already" | "invalid" = "invalid";

  if (isUnsubscribeTokenShape(token)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unsubscribe_newsletter", {
      p_token: token!.trim(),
    });
    if (!error) {
      const result = data as { ok?: boolean; already?: boolean } | null;
      state = result?.already ? "already" : "ok";
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
      <h1 className="text-h2 text-[var(--nexo-text)]">Newsletter</h1>
      {state === "ok" ? (
        <p className="mt-4 text-body text-[var(--nexo-text-muted)]">
          You’ve been unsubscribed. You won’t receive further newsletter emails from Nexo.
        </p>
      ) : state === "already" ? (
        <p className="mt-4 text-body text-[var(--nexo-text-muted)]">
          This address is already unsubscribed.
        </p>
      ) : (
        <p className="mt-4 text-body text-[var(--nexo-text-muted)]">
          This unsubscribe link is invalid or expired.
        </p>
      )}
      <Link href="/" className="mt-8 inline-flex">
        <Button variant="outline" className="rounded-full">
          Back to home
        </Button>
      </Link>
    </div>
  );
}
