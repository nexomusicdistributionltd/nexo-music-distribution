"use client";

import * as React from "react";
import { DashboardMock } from "@/components/marketing/home/DashboardMock";
import { DisplayHeading } from "@/components/public/DisplayHeading";
import { NumberedLabel } from "@/components/public/NumberedLabel";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    index: "01",
    title: "Distribution & label management",
    body: "Deliver worldwide to 450+ platforms from artist or label accounts, with quality control before send.",
  },
  {
    index: "02",
    title: "Catalog & analytics views",
    body: "Follow release status and performance trends as reporting data becomes available — no invented live charts.",
  },
  {
    index: "03",
    title: "Royalty tracking & publishing",
    body: "Review statements, payouts, and Nexo Publishing Group pathways for sync, mechanical, and administration.",
  },
  {
    index: "04",
    title: "Protection & artist tools",
    body: "Content ID tooling, support, and release workflows designed for independent catalogs.",
  },
];

export function PortalPreview() {
  const [active, setActive] = React.useState(0);
  return (
    <section className="pub-section pub-container">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <NumberedLabel index="03">Client portal preview</NumberedLabel>
          <DisplayHeading className="mt-5">
            Release.
            <br />
            Track. Manage.
          </DisplayHeading>
        </div>
        <p className="pub-body max-w-md">
          A visual preview of how release, analytics, and royalty information can be organized.
          Live account data appears only after sign-in. Figures shown are illustrative.
        </p>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <ul className="space-y-6">
          {FEATURES.map((f, i) => (
            <li key={f.index}>
              <button
                type="button"
                className={cn(
                  "w-full text-left transition-opacity duration-300",
                  active === i ? "opacity-100" : "opacity-45 hover:opacity-80"
                )}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span className="pub-kicker">{f.index}</span>
                <h3 className="pub-service-title mt-2">{f.title}</h3>
                <p className="pub-body mt-2 max-w-sm">{f.body}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className="pub-portal">
          <div className="flex items-center justify-between border-b border-[var(--nexo-border)] px-4 py-3">
            <p className="pub-kicker text-[var(--nexo-text)]">Nexo / Portal ↗</p>
            <span className="rounded-full border border-[var(--nexo-border)] px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-[var(--nexo-text-muted)]">
              Sample interface
            </span>
          </div>
          <DashboardMock className="rounded-none border-0 shadow-none" />
        </div>
      </div>
    </section>
  );
}
