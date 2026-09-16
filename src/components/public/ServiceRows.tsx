"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export type ServiceRow = {
  index: string;
  title: string;
  body: string;
  href: string;
};

export function ServiceRows({ items }: { items: ServiceRow[] }) {
  return (
    <div className="mt-12 space-y-2">
      {items.map((item, i) => (
        <Link key={item.title} href={item.href} className="pub-service" data-active={i === 1}>
          <span className="pub-kicker">{item.index}</span>
          <span className="pub-service-title">{item.title}</span>
          <span className="hidden items-center gap-8 lg:flex">
            <span className="pub-body max-w-xs">{item.body}</span>
            <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );
}
