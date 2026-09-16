import Link from "next/link";
import { DisplayHeading } from "@/components/public/DisplayHeading";

export function PlanTeasers() {
  return (
    <section className="pub-section pub-container">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <DisplayHeading>
          Your
          <br />
          distribution
          <br />
          plan.
        </DisplayHeading>
        <p className="pub-body max-w-sm lg:justify-self-end">
          Artist Starter is free. Paid Artist Pro, Label Starter, and Label Pro plans are
          billed in USD with a 7-day trial. Tax is calculated by Paddle at checkout.
        </p>
      </div>
      <div className="mt-12 space-y-2">
        <Link href="/pricing?type=artist" className="pub-plan block">
          <p className="pub-plan-name">Artist</p>
          <p className="pub-body max-w-md">
            For solo creators: one artist account, global delivery to 450+ platforms, royalty
            workflows, and optional publishing through Nexo Publishing Group.
          </p>
          <p className="pub-plan-rate">
            Free
            <span className="mt-1 block font-[family-name:var(--pub-sans)] text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
              Starter · Pro from $9.99
            </span>
          </p>
        </Link>
        <Link href="/pricing?type=label" className="pub-plan block">
          <p className="pub-plan-name">Label</p>
          <p className="pub-body max-w-md">
            For rosters: multi-artist delivery, shared quality control, reporting that holds
            up across a catalog, and publishing pathways when you need them.
          </p>
          <p className="pub-plan-rate">
            $19.99
            <span className="mt-1 block font-[family-name:var(--pub-sans)] text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
              Starter / mo · Pro $49.99
            </span>
          </p>
        </Link>
      </div>
    </section>
  );
}
