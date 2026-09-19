import { cn } from "@/lib/utils";
import type { WebsitePartner } from "@/lib/website/partner-types";

export function PartnerLogoMarquee({
  partners,
  className,
}: {
  partners: WebsitePartner[];
  className?: string;
}) {
  if (!partners.length) return null;

  // Duplicate for seamless RTL loop (CSS translates -50%)
  const row = [...partners, ...partners];

  return (
    <section
      className={cn(
        "border-y border-[var(--nexo-border)] bg-[var(--nexo-surface)] py-10 sm:py-12",
        className
      )}
      aria-label="Partners"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-4 text-label font-semibold tracking-wide text-[var(--nexo-text)]">
          Partners
        </p>
        <div className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--nexo-surface)] to-transparent sm:w-16"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--nexo-surface)] to-transparent sm:w-16"
            aria-hidden
          />
          <div className="nexo-partner-marquee-track" aria-hidden>
            {row.map((p, i) => (
              <PartnerChip key={`${p.id}-${i}`} partner={p} />
            ))}
          </div>
          <ul className="sr-only">
            {partners.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PartnerChip({ partner }: { partner: WebsitePartner }) {
  const inner = (
    <span className="mx-5 inline-flex h-20 min-w-[180px] shrink-0 items-center justify-center gap-3 rounded-[var(--nexo-radius)] px-4 opacity-90 transition-opacity hover:opacity-100 sm:mx-7 sm:h-24 sm:min-w-[220px]">
      {partner.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={partner.logo_url}
          alt=""
          className="h-12 w-auto max-w-[170px] object-contain sm:h-16 sm:max-w-[220px]"
        />
      ) : null}
      <span className="whitespace-nowrap text-small font-semibold tracking-wide text-[var(--nexo-text-secondary)]">
        {partner.name}
      </span>
    </span>
  );

  if (partner.website_url) {
    return (
      <a
        href={partner.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
