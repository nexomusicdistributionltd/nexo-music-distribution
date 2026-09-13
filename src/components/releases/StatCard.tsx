import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{label}</p>
        <p className="mt-2 text-h2 tabular-nums text-[var(--nexo-text)]">{value}</p>
        {hint ? <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
