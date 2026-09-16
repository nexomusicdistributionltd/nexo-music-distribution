import { DSP_BRANDS } from "@/lib/dsp-brands";
import { CountUp } from "@/components/public/CountUp";
import { DisplayHeading } from "@/components/public/DisplayHeading";
import { CONFIRMED_STATS } from "@/lib/site";

const STREAMING = ["Spotify", "Apple Music", "YouTube Music", "Amazon Music", "TIDAL", "Deezer"];
const SOCIAL = ["YouTube", "TikTok", "Instagram", "Facebook", "SoundCloud", "Bandcamp"];
const DISCOVERY = ["Shazam", "Beatport"];

function Column({
  index,
  title,
  names,
}: {
  index: string;
  title: string;
  names: string[];
}) {
  return (
    <div className="pub-platform-col">
      <p className="pub-kicker mb-6">
        {index} {title}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {names.map((n, i) => (
          <li key={n} className={`pub-platform-name ${i > 0 ? "is-dim" : ""}`}>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlatformDestinations() {
  return (
    <section className="pub-section pub-container">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="pub-kicker">Global distribution / 450+ platforms</p>
          <DisplayHeading className="mt-6">
            One upload.
            <br />
            Everywhere.
          </DisplayHeading>
        </div>
        <div>
          <p className="pub-body mb-6 max-w-md">
            NEXO delivers releases to the major streaming, video, social, and specialist
            destinations named on this site — continuously expanding as the market evolves.
          </p>
          <div className="grid grid-cols-2 gap-px bg-[var(--nexo-border)]">
            {CONFIRMED_STATS.map((s) => (
              <div key={s.label} className="bg-[var(--nexo-elevated)] p-5">
                <p className="pub-stat-num">
                  <CountUp value={s.value} />
                </p>
                <p className="pub-kicker mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-16 grid gap-px bg-[var(--nexo-border)] lg:grid-cols-3">
        <div className="flex items-end justify-between bg-[var(--nexo-elevated)] px-5 py-4 lg:col-span-3">
          <p className="pub-kicker">Selected destinations</p>
          <p className="pub-body max-w-sm text-right">
            Streaming, download, social, and specialty platforms available through Nexo
            distribution.
          </p>
        </div>
        <Column index="01" title="Streaming" names={STREAMING} />
        <Column index="02" title="Video & social" names={SOCIAL} />
        <Column index="03" title="Discovery" names={DISCOVERY} />
      </div>
      <p className="sr-only">
        Full list: {DSP_BRANDS.map((b) => b.title).join(", ")}.
      </p>
    </section>
  );
}
