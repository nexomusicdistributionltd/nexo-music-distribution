import Link from "next/link";

const LINKS = [
  { href: "/earnings", label: "Balances" },
  { href: "/earnings/statements", label: "Statements" },
  { href: "/earnings/transactions", label: "Transactions" },
  { href: "/earnings/payouts", label: "Payouts" },
  { href: "/earnings/tracks", label: "Tracks" },
  { href: "/earnings/splits", label: "Splits" },
  { href: "/app/publishing", label: "Publishing" },
];

export function EarningsNav() {
  return (
    <nav className="mb-4 flex flex-wrap gap-3 text-small" aria-label="Earnings">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
