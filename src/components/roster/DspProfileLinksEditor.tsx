"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { DspIcon } from "@/components/fanlink/DspIcon";
import { DSP_PROFILE_SPECS, type ArtistDspLink, type DspProfileKey } from "@/lib/dsp/profile-links";
import {
  previewDspProfileAction,
  saveArtistDspLinksAction,
} from "@/app/(portal)/app/artists/dsp-actions";

type RowState = {
  url: string;
  enabled: boolean;
  preview_name: string | null;
  preview_image_url: string | null;
};

export function DspProfileLinksEditor({
  artistProfileId,
  initial,
}: {
  artistProfileId: string;
  initial: ArtistDspLink[];
}) {
  const router = useRouter();
  const byKey = new Map(initial.map((l) => [l.dsp_key, l]));
  const [rows, setRows] = React.useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const spec of DSP_PROFILE_SPECS) {
      const cur = byKey.get(spec.key);
      out[spec.key] = {
        url: cur?.url ?? "",
        enabled: Boolean(cur?.enabled && cur.url),
        preview_name: cur?.preview_name ?? null,
        preview_image_url: cur?.preview_image_url ?? null,
      };
    }
    return out;
  });
  const [pending, setPending] = React.useState(false);
  const [fetching, setFetching] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  async function fetchPreview(key: DspProfileKey) {
    const url = rows[key]?.url ?? "";
    if (!url.trim()) return;
    setFetching(key);
    const res = await previewDspProfileAction({ dspKey: key, url });
    setFetching(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        preview_name: res.data.name,
        preview_image_url: res.data.image,
      },
    }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(null);
        const res = await saveArtistDspLinksAction({
          artistProfileId,
          links: DSP_PROFILE_SPECS.map((spec) => ({
            dspKey: spec.key,
            url: rows[spec.key]?.url ?? "",
            enabled: Boolean(rows[spec.key]?.enabled),
            previewName: rows[spec.key]?.preview_name,
            previewImage: rows[spec.key]?.preview_image_url,
          })),
        });
        setPending(false);
        if (!res.ok) setError(res.error);
        else {
          setOk("DSP profile links saved. Enabled stores are used as targeting metadata on submit.");
          router.refresh();
        }
      }}
    >
      <div>
        <h2 className="text-h4">DSP profile links</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Paste artist profile URLs. Toggle off a store if this artist has no profile there. This is
          targeting metadata only — not a commercial DSP connection.
        </p>
      </div>
      {error ? (
        <Alert variant="warning" title="Not saved">
          {error}
        </Alert>
      ) : null}
      {ok ? <Alert title="Saved">{ok}</Alert> : null}
      <ul className="space-y-3">
        {DSP_PROFILE_SPECS.map((spec) => {
          const row = rows[spec.key];
          return (
            <li
              key={spec.key}
              className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-small font-medium">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [spec.key]: { ...prev[spec.key], enabled: e.target.checked },
                      }))
                    }
                  />
                  <DspIcon name={spec.key === "applemusic" ? "apple_music" : spec.key} className="h-5 w-5" />
                  {spec.title}
                </label>
                {row.preview_name ? (
                  <span className="text-caption text-[var(--nexo-text-muted)]">{row.preview_name}</span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {row.preview_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.preview_image_url}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : null}
                <Input
                  value={row.url}
                  onChange={(e) =>
                    setRows((prev) => ({
                      ...prev,
                      [spec.key]: { ...prev[spec.key], url: e.target.value, enabled: Boolean(e.target.value) && prev[spec.key].enabled },
                    }))
                  }
                  onBlur={() => void fetchPreview(spec.key)}
                  placeholder={`https://… ${spec.title} profile`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fetching === spec.key || !row.url.trim()}
                  onClick={() => void fetchPreview(spec.key)}
                >
                  {fetching === spec.key ? "…" : "Preview"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save DSP links"}
      </Button>
    </form>
  );
}
