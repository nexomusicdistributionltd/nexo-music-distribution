import { TableSkeleton } from "@/components/workspace/QueryPagination";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--nexo-elevated)]" />
      <TableSkeleton />
    </div>
  );
}
