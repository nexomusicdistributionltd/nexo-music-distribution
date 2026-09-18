"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { setArtistWebsiteAction } from "@/app/admin/website/actions";

type Props = {
  artist: {
    id: string;
    artist_name: string | null;
    stage_name: string | null;
    public_slug: string | null;
    public_tagline: string | null;
    public_bio_html: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    website_published: boolean;
    website_featured: boolean;
    genres?: string[] | null;
    country?: string | null;
    social_links?: Record<string, string> | null;
  };
};

export function ArtistWebsiteEditor({ artist }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const socials = artist.social_links ?? {};
  const [form, setForm] = useState({
    artistName: artist.artist_name || artist.stage_name || "",
    slug: artist.public_slug || "",
    tagline: artist.public_tagline || "",
    bioHtml: artist.public_bio_html || "",
    genres: (artist.genres ?? []).join(", "),
    country: artist.country || "",
    avatarUrl: artist.avatar_url || "",
    coverUrl: artist.cover_url || "",
    spotify: socials.spotify || "",
    instagram: socials.instagram || "",
    website: socials.website || "",
    entzopedia: socials.entzopedia || "",
    published: artist.website_published,
    featured: artist.website_featured,
  });

  return (
    <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h4">Website / public bio</h2>
        {form.slug ? (
          <Link
            href={`/artist/${form.slug}`}
            className="text-caption underline"
            target="_blank"
          >
            Preview public page
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-caption">
          Display name
          <Input
            className="mt-1"
            value={form.artistName}
            onChange={(e) => setForm((f) => ({ ...f, artistName: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Public slug
          <Input
            className="mt-1"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Country
          <Input
            className="mt-1"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Genres (comma-separated)
          <Input
            className="mt-1"
            value={form.genres}
            onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Avatar image URL
          <Input
            className="mt-1"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Cover image URL
          <Input
            className="mt-1"
            value={form.coverUrl}
            onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
          />
        </label>
      </div>
      <label className="block text-caption">
        Tagline
        <Input
          className="mt-1"
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
        />
      </label>
      <label className="block text-caption">
        Bio HTML (sanitized on save)
        <Textarea
          className="mt-1 font-mono text-caption"
          rows={8}
          value={form.bioHtml}
          onChange={(e) => setForm((f) => ({ ...f, bioHtml: e.target.value }))}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-caption">
          Spotify URL
          <Input
            className="mt-1"
            value={form.spotify}
            onChange={(e) => setForm((f) => ({ ...f, spotify: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Instagram URL
          <Input
            className="mt-1"
            value={form.instagram}
            onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Website URL
          <Input
            className="mt-1"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Entzopedia artist URL
          <Input
            className="mt-1"
            placeholder="https://entzopedia.com/..."
            value={form.entzopedia}
            onChange={(e) => setForm((f) => ({ ...f, entzopedia: e.target.value }))}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-small">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
          />
          Website published
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          />
          Featured on homepage
        </label>
      </div>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const genres = form.genres
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean);
            const socialLinks: Record<string, string> = {};
            if (form.spotify) socialLinks.spotify = form.spotify;
            if (form.instagram) socialLinks.instagram = form.instagram;
            if (form.website) socialLinks.website = form.website;
            if (form.entzopedia) socialLinks.entzopedia = form.entzopedia;
            const res = await setArtistWebsiteAction({
              artistProfileId: artist.id,
              artistName: form.artistName,
              slug: form.slug || form.artistName,
              tagline: form.tagline,
              bioHtml: form.bioHtml,
              genres,
              country: form.country || null,
              avatarUrl: form.avatarUrl || null,
              coverUrl: form.coverUrl || null,
              socialLinks,
              published: form.published,
              featured: form.featured,
            });
            setMsg(res.ok ? "Artist website profile saved." : res.error);
          })
        }
      >
        Save website profile
      </Button>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </section>
  );
}
