"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseBillingSelection } from "@/lib/billing/auth-return";
import { preserveBillingQuery } from "@/lib/billing/auth-return";

export function LoginRegisterLink() {
  const search = useSearchParams();
  const selection = parseBillingSelection({
    plan: search.get("plan"),
    interval: search.get("interval"),
  });
  const qs = preserveBillingQuery(search);
  const type = selection?.planId.startsWith("label") ? "label" : search.get("type") === "label" ? "label" : "artist";
  const href = `/register?type=${type}${qs ? `&${qs.replace(/^\?/, "")}` : ""}`;
  return (
    <Link href={href} className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
      Create an account
    </Link>
  );
}
