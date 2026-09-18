import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notification",
  robots: { index: false, follow: false },
};

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await RequireRole(["artist", "label"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!data) notFound();

  if (!data.read_at) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .is("read_at", null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/notifications" className="text-small underline-offset-4 hover:underline">
        ← All notifications
      </Link>
      <article className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
        <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
          {String(data.type).replace(/_/g, " ")} · {new Date(data.created_at).toLocaleString()}
        </p>
        <h1 className="mt-3 text-h2">{data.title}</h1>
        <div className="mt-5 whitespace-pre-wrap text-small leading-7 text-[var(--nexo-text-secondary)]">
          {data.body}
        </div>
        {data.entity_type === "release" && data.entity_id ? (
          <Link
            href={`/dashboard/releases/${data.entity_id}`}
            className="mt-6 inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
          >
            Open release
          </Link>
        ) : null}
        {data.entity_type === "identity_verification" ? (
          <Link
            href="/verify-identity"
            className="mt-6 inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
          >
            Open verification
          </Link>
        ) : null}
        {data.entity_type === "distribution_agreement" ? (
          <Link
            href="/distribution-agreement"
            className="mt-6 inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
          >
            Open agreement
          </Link>
        ) : null}
      </article>
    </div>
  );
}
