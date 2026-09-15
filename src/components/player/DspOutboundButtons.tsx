import { ExternalLink } from "lucide-react";
import type { DspOutboundLink } from "@/lib/website/dsp-links";

/** Clear outbound DSP links — never iframes. */
export function DspOutboundButtons({ links }: { links: DspOutboundLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] px-3 py-1.5 text-caption text-[var(--nexo-text-secondary)] transition hover:border-[var(--nexo-border-strong)] hover:text-[var(--nexo-text)]"
        >
          {l.label}
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      ))}
    </div>
  );
}
