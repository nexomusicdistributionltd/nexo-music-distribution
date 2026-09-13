"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-h2">Something went wrong</h1>
      <p className="text-small text-[var(--nexo-text-muted)]">
        An unexpected error occurred. Please try again. No internal details are shown.
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
