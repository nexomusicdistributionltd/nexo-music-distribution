import { TableSkeleton } from "@/components/workspace/QueryPagination";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded bg-[var(--nexo-elevated)]" />
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
