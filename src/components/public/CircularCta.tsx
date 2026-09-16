import Link from "next/link";
import { cn } from "@/lib/utils";

export function CircularCta({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("pub-orb", className)}>
      <span className="max-w-[6.2rem] px-2">{children}</span>
    </Link>
  );
}
