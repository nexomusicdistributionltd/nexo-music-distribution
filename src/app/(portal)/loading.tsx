export default function PortalLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="h-2 w-28 animate-pulse rounded-full bg-[var(--nexo-elevated)]" />
      <div className="h-8 w-56 animate-pulse rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]"
          />
        ))}
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
