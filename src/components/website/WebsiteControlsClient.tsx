"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  setReleaseWebsiteAction,
  setArtistWebsiteAction,
} from "@/app/admin/website/actions";

type ReleaseRow = {
  id: string;
  title: string;
  primary_artist_name: string;
  status: string;
  website_published: boolean;
  website_featured: boolean;
  website_slug: string | null;
  website_sort_order: number;
  website_playback_enabled: boolean;
  website_embed_spotify_url?: string | null;
  website_embed_apple_url?: string | null;
  website_embed_youtube_url?: string | null;
};

type ArtistRow = {
  id: string;
  artist_name: string | null;
  stage_name: string | null;
  public_slug: string | null;
  website_published: boolean;
  website_featured: boolean;
  public_tagline: string | null;
};

export function WebsiteControlsClient({
  releases,
  artists,
}: {
  releases: ReleaseRow[];
  artists: ArtistRow[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [dsp, setDsp] = useState<
    Record<string, { spotify?: string; apple?: string; youtube?: string }>
  >({});

  return (
    <div className="space-y-10">
      <p className="text-small text-[var(--nexo-text-muted)]">
        Primary public playback uses the <strong>Nexo Music Player</strong> (signed{" "}
        <code>release-audio</code> URLs when published + playback enabled). DSP fields below
        are <strong>outbound links only</strong> — never embedded as the primary player.
      </p>

      <section>
        <h2 className="text-h4">Releases</h2>
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {releases.map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-3 text-small">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {r.title}{" "}
                    <span className="text-caption text-[var(--nexo-text-muted)]">
                      · {r.primary_artist_name} · status {r.status}
                    </span>
                  </p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    published={String(r.website_published)} featured=
                    {String(r.website_featured)} slug={r.website_slug || "—"} playback=
                    {String(r.website_playback_enabled)}
                    {r.website_slug ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link
                          href={`/release/${r.website_slug}`}
                          className="underline"
                          target="_blank"
                        >
                          preview
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setReleaseWebsiteAction({
                          releaseId: r.id,
                          published: !r.website_published,
                          slug: slugs[r.id] || r.website_slug || r.title,
                        });
                        setMsg(res.ok ? "Release website updated." : res.error);
                      })
                    }
                  >
                    {r.website_published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setReleaseWebsiteAction({
                          releaseId: r.id,
                          featured: !r.website_featured,
                        });
                        setMsg(res.ok ? "Featured toggled." : res.error);
                      })
                    }
                  >
                    {r.website_featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setReleaseWebsiteAction({
                          releaseId: r.id,
                          playbackEnabled: !r.website_playback_enabled,
                        });
                        setMsg(res.ok ? "Nexo playback flag updated." : res.error);
                      })
                    }
                  >
                    {r.website_playback_enabled
                      ? "Disable Nexo playback"
                      : "Enable Nexo playback"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder="Slug"
                  defaultValue={r.website_slug ?? ""}
                  onChange={(e) =>
                    setSlugs((s) => ({ ...s, [r.id]: e.target.value }))
                  }
                />
                <Input
                  placeholder="Listen on Spotify URL (outbound)"
                  defaultValue={r.website_embed_spotify_url ?? ""}
                  onChange={(e) =>
                    setDsp((s) => ({
                      ...s,
                      [r.id]: { ...s[r.id], spotify: e.target.value },
                    }))
                  }
                  onBlur={() =>
                    start(async () => {
                      const v = dsp[r.id]?.spotify;
                      if (v === undefined) return;
                      const res = await setReleaseWebsiteAction({
                        releaseId: r.id,
                        embedSpotify: v,
                        slug: slugs[r.id] || r.website_slug || undefined,
                      });
                      setMsg(res.ok ? "Spotify outbound link saved." : res.error);
                    })
                  }
                />
                <Input
                  placeholder="Listen on Apple Music URL (outbound)"
                  defaultValue={r.website_embed_apple_url ?? ""}
                  onChange={(e) =>
                    setDsp((s) => ({
                      ...s,
                      [r.id]: { ...s[r.id], apple: e.target.value },
                    }))
                  }
                  onBlur={() =>
                    start(async () => {
                      const v = dsp[r.id]?.apple;
                      if (v === undefined) return;
                      const res = await setReleaseWebsiteAction({
                        releaseId: r.id,
                        embedApple: v,
                      });
                      setMsg(res.ok ? "Apple outbound link saved." : res.error);
                    })
                  }
                />
                <Input
                  placeholder="YouTube / video URL (outbound)"
                  defaultValue={r.website_embed_youtube_url ?? ""}
                  onChange={(e) =>
                    setDsp((s) => ({
                      ...s,
                      [r.id]: { ...s[r.id], youtube: e.target.value },
                    }))
                  }
                  onBlur={() =>
                    start(async () => {
                      const v = dsp[r.id]?.youtube;
                      if (v === undefined) return;
                      const res = await setReleaseWebsiteAction({
                        releaseId: r.id,
                        embedYoutube: v,
                      });
                      setMsg(res.ok ? "YouTube outbound link saved." : res.error);
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-h4">Artists</h2>
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {artists.map((a) => {
            const name = a.artist_name || a.stage_name || a.id;
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-small"
              >
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    slug={a.public_slug || "—"} published=
                    {String(a.website_published)}
                    {" · "}
                    <Link href={`/admin/artists/${a.id}`} className="underline">
                      Edit bio
                    </Link>
                    {a.public_slug ? (
                      <>
                        {" · "}
                        <Link
                          href={`/artist/${a.public_slug}`}
                          className="underline"
                          target="_blank"
                        >
                          preview
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setArtistWebsiteAction({
                          artistProfileId: a.id,
                          featured: !a.website_featured,
                        });
                        setMsg(res.ok ? "Artist featured toggled." : res.error);
                      })
                    }
                  >
                    {a.website_featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setArtistWebsiteAction({
                          artistProfileId: a.id,
                          published: !a.website_published,
                          slug: a.public_slug || String(name),
                        });
                        setMsg(res.ok ? "Artist website updated." : res.error);
                      })
                    }
                  >
                    {a.website_published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
