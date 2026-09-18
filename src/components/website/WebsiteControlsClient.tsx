"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  setReleaseWebsiteAction,
  setArtistWebsiteAction,
} from "@/app/admin/website/actions";
import { uploadCmsMediaAction } from "@/app/admin/website/media-actions";

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
  website_cover_override_url?: string | null;
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
  const [uploadingRelease, setUploadingRelease] = useState<string | null>(null);
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [dsp, setDsp] = useState<
    Record<string, { spotify?: string; apple?: string; youtube?: string }>
  >({});

  async function uploadReleaseCover(release: ReleaseRow, file: File | null) {
    if (!file) return;
    setUploadingRelease(release.id);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const uploaded = await uploadCmsMediaAction(formData);
      if (!uploaded.ok) {
        setMsg(uploaded.error);
        return;
      }
      const url = uploaded.data?.publicUrl;
      if (!url) {
        setMsg("Upload completed but no public artwork URL was returned.");
        return;
      }
      setCovers((current) => ({ ...current, [release.id]: url }));
      const result = await setReleaseWebsiteAction({
        releaseId: release.id,
        coverUrl: url,
      });
      setMsg(result.ok ? "Release artwork uploaded and published to the showcase." : result.error);
    } finally {
      setUploadingRelease(null);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3">
          <h2 className="text-h4">Featured music & public catalog</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Publish releases to Nexo Music Distribution, choose which releases are featured on the
            homepage, upload showcase artwork, and control Nexo playback. DSP URLs remain outbound
            destinations, not the primary Nexo player.
          </p>
        </div>

        <div className="grid gap-4">
          {releases.map((release) => {
            const cover =
              covers[release.id] ?? release.website_cover_override_url ?? "";
            return (
              <article
                key={release.id}
                className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-[var(--nexo-elevated)]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-2 text-center text-caption text-[var(--nexo-text-muted)]">
                        No artwork
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {release.title}{" "}
                      <span className="text-caption text-[var(--nexo-text-muted)]">
                        · {release.primary_artist_name}
                      </span>
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      Catalog status: {release.status} · Website:{" "}
                      {release.website_published ? "published" : "hidden"} · Homepage:{" "}
                      {release.website_featured ? "featured" : "not featured"} · Nexo playback:{" "}
                      {release.website_playback_enabled ? "enabled" : "disabled"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-caption">
                      {release.website_slug ? (
                        <Link
                          href={`/release/${release.website_slug}`}
                          className="underline"
                          target="_blank"
                        >
                          Preview public release
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await setReleaseWebsiteAction({
                            releaseId: release.id,
                            published: !release.website_published,
                            slug:
                              slugs[release.id] ||
                              release.website_slug ||
                              release.title,
                          });
                          setMsg(
                            result.ok
                              ? release.website_published
                                ? "Release removed from the public website."
                                : "Release published to the public website."
                              : result.error
                          );
                        })
                      }
                    >
                      {release.website_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await setReleaseWebsiteAction({
                            releaseId: release.id,
                            featured: !release.website_featured,
                          });
                          setMsg(
                            result.ok
                              ? release.website_featured
                                ? "Release removed from homepage showcase."
                                : "Release added to homepage showcase."
                              : result.error
                          );
                        })
                      }
                    >
                      {release.website_featured ? "Unfeature" : "Feature"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await setReleaseWebsiteAction({
                            releaseId: release.id,
                            playbackEnabled: !release.website_playback_enabled,
                          });
                          setMsg(
                            result.ok
                              ? "Nexo playback setting updated."
                              : result.error
                          );
                        })
                      }
                    >
                      {release.website_playback_enabled
                        ? "Disable playback"
                        : "Enable playback"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <Input
                    placeholder="Public slug"
                    defaultValue={release.website_slug ?? ""}
                    onChange={(e) =>
                      setSlugs((current) => ({
                        ...current,
                        [release.id]: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Showcase artwork URL"
                    value={cover}
                    onChange={(e) =>
                      setCovers((current) => ({
                        ...current,
                        [release.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const value = covers[release.id];
                      if (value === undefined) return;
                      start(async () => {
                        const result = await setReleaseWebsiteAction({
                          releaseId: release.id,
                          coverUrl: value || null,
                        });
                        setMsg(result.ok ? "Showcase artwork saved." : result.error);
                      });
                    }}
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] px-3 text-caption text-[var(--nexo-text-muted)]">
                    {uploadingRelease === release.id
                      ? "Uploading artwork…"
                      : "Upload showcase artwork"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={pending || uploadingRelease === release.id}
                      onChange={(e) =>
                        uploadReleaseCover(release, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <Input
                    inputMode="numeric"
                    placeholder="Display order"
                    defaultValue={String(release.website_sort_order ?? 0)}
                    onBlur={(e) =>
                      start(async () => {
                        const result = await setReleaseWebsiteAction({
                          releaseId: release.id,
                          sortOrder: Number(e.target.value) || 0,
                        });
                        setMsg(result.ok ? "Release display order saved." : result.error);
                      })
                    }
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    placeholder="Spotify URL"
                    defaultValue={release.website_embed_spotify_url ?? ""}
                    onChange={(e) =>
                      setDsp((current) => ({
                        ...current,
                        [release.id]: {
                          ...current[release.id],
                          spotify: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      start(async () => {
                        const value = dsp[release.id]?.spotify;
                        if (value === undefined) return;
                        const result = await setReleaseWebsiteAction({
                          releaseId: release.id,
                          embedSpotify: value,
                          slug:
                            slugs[release.id] ||
                            release.website_slug ||
                            undefined,
                        });
                        setMsg(result.ok ? "Spotify destination saved." : result.error);
                      })
                    }
                  />
                  <Input
                    placeholder="Apple Music URL"
                    defaultValue={release.website_embed_apple_url ?? ""}
                    onChange={(e) =>
                      setDsp((current) => ({
                        ...current,
                        [release.id]: {
                          ...current[release.id],
                          apple: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      start(async () => {
                        const value = dsp[release.id]?.apple;
                        if (value === undefined) return;
                        const result = await setReleaseWebsiteAction({
                          releaseId: release.id,
                          embedApple: value,
                        });
                        setMsg(result.ok ? "Apple Music destination saved." : result.error);
                      })
                    }
                  />
                  <Input
                    placeholder="YouTube / video URL"
                    defaultValue={release.website_embed_youtube_url ?? ""}
                    onChange={(e) =>
                      setDsp((current) => ({
                        ...current,
                        [release.id]: {
                          ...current[release.id],
                          youtube: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      start(async () => {
                        const value = dsp[release.id]?.youtube;
                        if (value === undefined) return;
                        const result = await setReleaseWebsiteAction({
                          releaseId: release.id,
                          embedYoutube: value,
                        });
                        setMsg(result.ok ? "YouTube destination saved." : result.error);
                      })
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-h4">Featured artists</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Publish verified artist profiles and choose homepage features. Artist images, bio,
            socials and the optional Entzopedia profile link are managed from the artist website
            editor.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {artists.map((artist) => {
            const name = artist.artist_name || artist.stage_name || artist.id;
            return (
              <article
                key={artist.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small"
              >
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {artist.website_published ? "Published" : "Hidden"} ·{" "}
                    {artist.website_featured ? "Featured" : "Not featured"} · slug{" "}
                    {artist.public_slug || "not set"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-caption">
                    <Link href={`/admin/artists/${artist.id}`} className="underline">
                      Edit artist profile, image & Entzopedia link
                    </Link>
                    {artist.public_slug ? (
                      <Link
                        href={`/artist/${artist.public_slug}`}
                        className="underline"
                        target="_blank"
                      >
                        Preview
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await setArtistWebsiteAction({
                          artistProfileId: artist.id,
                          featured: !artist.website_featured,
                        });
                        setMsg(
                          result.ok
                            ? artist.website_featured
                              ? "Artist removed from homepage showcase."
                              : "Artist added to homepage showcase."
                            : result.error
                        );
                      })
                    }
                  >
                    {artist.website_featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await setArtistWebsiteAction({
                          artistProfileId: artist.id,
                          published: !artist.website_published,
                          slug: artist.public_slug || String(name),
                        });
                        setMsg(
                          result.ok
                            ? artist.website_published
                              ? "Artist removed from public website."
                              : "Artist published to public website."
                            : result.error
                        );
                      })
                    }
                  >
                    {artist.website_published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
