"use client";

export default function AdminErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-h2">Admin page could not load</h1>
      <p className="text-small text-[var(--nexo-text-muted)]">
        A query failed or a relation is missing. No placeholder data is shown. Try again after
        migrations, or open another admin section.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-[var(--nexo-radius-md)] bg-[var(--nexo-accent)] px-4 py-2 text-small font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
