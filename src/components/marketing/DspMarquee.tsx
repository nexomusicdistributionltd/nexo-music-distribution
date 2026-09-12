import { cn } from "@/lib/utils";
import { DSP_BRANDS } from "@/lib/dsp-brands";

function DspLogo({ title, path }: { title: string; path: string }) {
  return (
    <div
      className="mx-4 flex h-12 shrink-0 items-center gap-2.5 opacity-80 transition-opacity duration-[var(--nexo-duration)] hover:opacity-100"
      title={title}
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 fill-current text-[var(--nexo-text)]"
        aria-hidden
      >
        <path d={path} />
      </svg>
      <span className="whitespace-nowrap text-small font-medium tracking-wide text-[var(--nexo-text-secondary)]">
        {title}
      </span>
    </div>
  );
}

export function DspMarquee({ className }: { className?: string }) {
  const row = [...DSP_BRANDS, ...DSP_BRANDS];
  return (
    <section
      className={cn(
        "border-y border-[var(--nexo-border)] bg-[var(--nexo-surface)] py-6",
        className
      )}
      aria-label="Your music on 450+ platforms"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-8">
        <p className="shrink-0 text-label font-semibold tracking-wide text-[var(--nexo-text)] lg:max-w-[11rem]">
          Your Music on 450+ Platforms
        </p>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--nexo-surface)] to-transparent sm:w-16"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--nexo-surface)] to-transparent sm:w-16"
            aria-hidden
          />
          <div className="nexo-marquee-track" aria-hidden>
            {row.map((brand, i) => (
              <DspLogo key={`${brand.key}-${i}`} title={brand.title} path={brand.path} />
            ))}
          </div>
          <ul className="sr-only">
            {DSP_BRANDS.map((b) => (
              <li key={b.key}>{b.title}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
