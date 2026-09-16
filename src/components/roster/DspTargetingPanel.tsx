import { specForDsp } from "@/lib/dsp/profile-links";

export type DspTargetRow = {
  dsp_key: string;
  url: string;
  enabled: boolean;
};

export function DspTargetingPanel({ targets }: { targets: DspTargetRow[] }) {
  const enabled = targets.filter((t) => t.enabled && t.url);
  return (
    <section className="space-y-2">
      <h2 className="text-h4">DSP profile targeting</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Enabled artist profile URLs snapshotted for delivery targeting. This is metadata only — not a
        commercial DSP connection.
      </p>
      {enabled.length === 0 ? (
        <p className="text-small text-[var(--nexo-text-muted)]">
          No enabled DSP profile links on this release. Toggle links on the artist profile to target
          stores that have a page.
        </p>
      ) : (
        <ul className="space-y-1 text-small">
          {enabled.map((t) => {
            const title = specForDsp(t.dsp_key)?.title ?? t.dsp_key;
            return (
              <li key={t.dsp_key}>
                <span className="font-medium">{title}</span>{" "}
                <a
                  href={t.url}
                  className="underline-offset-4 hover:underline"
                  rel="noopener noreferrer"
                >
                  {t.url}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
