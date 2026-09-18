import Link from "next/link";

const LINKS = [
  { href: "/admin/finance", label: "Overview" },
  { href: "/admin/royalties", label: "Royalties" },
  { href: "/admin/royalties/imports", label: "Imports" },
  { href: "/admin/royalties/ledger", label: "Ledger" },
  { href: "/admin/statements", label: "Statements" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/finance/payout-methods", label: "Payout methods" },
  { href: "/admin/finance/billing", label: "Billing" },
  { href: "/admin/publishing", label: "Publishing" },
];

export function FinanceNav() {
  return (
    <nav className="mb-4 flex flex-wrap gap-3 text-small" aria-label="Finance">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
