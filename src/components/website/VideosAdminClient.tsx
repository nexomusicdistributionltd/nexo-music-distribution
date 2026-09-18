"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { upsertWebsiteVideoAction } from "@/app/admin/website/actions";
import { uploadCmsMediaAction } from "@/app/admin/website/media-actions";

type VideoRow = {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  artist_id: string | null;
  release_id: string | null;
  published: boolean;
  sort_order: number;
};

type ArtistOption = {
  id: string;
  artist_name: string | null;
  stage_name: string | null;
};

type ReleaseOption = {
  id: string;
  title: string;
  primary_artist_name: string;
};

const selectClass =
  "flex h-10 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]";

export function VideosAdminClient({
  videos,
  artists,
  releases,
}: {
  videos: VideoRow[];
  artists: ArtistOption[];
  releases: ReleaseOption[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    url: "",
    thumbnailUrl: "",
    artistId: "",
    releaseId: "",
    sortOrder: "0",
  });

  async function uploadThumbnail(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadCmsMediaAction(data);
      if (!result.ok) {
        setMsg(result.error);
        return;
      }
      setDraft((value) => ({
        ...value,
        thumbnailUrl: result.data?.publicUrl ?? value.thumbnailUrl,
      }));
      setMsg("Thumbnail uploaded to Nexo CMS media. Create or publish the video to use it.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
        <div>
          <h2 className="text-h4">Add video</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            The public card and player are Nexo-branded. External video URLs still stream from their
            original provider unless the URL points to a video file Nexo controls.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Video title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Input
            placeholder="Video URL — YouTube, Vimeo, MP4, WebM or other HTTPS link"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          />
          <Input
            placeholder="Thumbnail URL (optional)"
            value={draft.thumbnailUrl}
            onChange={(e) => setDraft((d) => ({ ...d, thumbnailUrl: e.target.value }))}
          />
          <label className="flex h-10 cursor-pointer items-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] px-3 text-caption text-[var(--nexo-text-muted)]">
            {uploading ? "Uploading thumbnail…" : "Upload thumbnail to Nexo CMS"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={pending || uploading}
              onChange={(e) => uploadThumbnail(e.target.files?.[0] ?? null)}
            />
          </label>

          <select
            className={selectClass}
            value={draft.artistId}
            onChange={(e) => setDraft((d) => ({ ...d, artistId: e.target.value }))}
          >
            <option value="">No artist association</option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.artist_name || artist.stage_name || artist.id}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={draft.releaseId}
            onChange={(e) => setDraft((d) => ({ ...d, releaseId: e.target.value }))}
          >
            <option value="">No release association</option>
            {releases.map((release) => (
              <option key={release.id} value={release.id}>
                {release.title} — {release.primary_artist_name}
              </option>
            ))}
          </select>

          <Input
            inputMode="numeric"
            placeholder="Sort order"
            value={draft.sortOrder}
            onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || uploading || !draft.title.trim() || !draft.url.trim()}
            onClick={() =>
              start(async () => {
                const res = await upsertWebsiteVideoAction({
                  title: draft.title,
                  url: draft.url,
                  thumbnailUrl: draft.thumbnailUrl || null,
                  artistId: draft.artistId || null,
                  releaseId: draft.releaseId || null,
                  sortOrder: Number(draft.sortOrder) || 0,
                  published: false,
                });
                setMsg(res.ok ? "Video created as draft." : res.error);
                if (res.ok) {
                  setDraft({
                    title: "",
                    url: "",
                    thumbnailUrl: "",
                    artistId: "",
                    releaseId: "",
                    sortOrder: "0",
                  });
                }
              })
            }
          >
            Save draft
          </Button>
          <Button
            variant="secondary"
            disabled={pending || uploading || !draft.title.trim() || !draft.url.trim()}
            onClick={() =>
              start(async () => {
                const res = await upsertWebsiteVideoAction({
                  title: draft.title,
                  url: draft.url,
                  thumbnailUrl: draft.thumbnailUrl || null,
                  artistId: draft.artistId || null,
                  releaseId: draft.releaseId || null,
                  sortOrder: Number(draft.sortOrder) || 0,
                  published: true,
                });
                setMsg(res.ok ? "Video published to the public website." : res.error);
                if (res.ok) {
                  setDraft({
                    title: "",
                    url: "",
                    thumbnailUrl: "",
                    artistId: "",
                    releaseId: "",
                    sortOrder: "0",
                  });
                }
              })
            }
          >
            Save & publish
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-h4">Video library</h2>
            <p className="text-caption text-[var(--nexo-text-muted)]">
              {videos.length} video{videos.length === 1 ? "" : "s"} in the website library.
            </p>
          </div>
        </div>
        {videos.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {videos.map((video) => (
              <VideoEditor
                key={video.id}
                video={video}
                artists={artists}
                releases={releases}
                setMsg={setMsg}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--nexo-radius-lg)] border border-dashed border-[var(--nexo-border)] p-8 text-center text-small text-[var(--nexo-text-muted)]">
            No videos yet. Add a link above and publish it when ready.
          </div>
        )}
      </section>

      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}

function VideoEditor({
  video,
  artists,
  releases,
  setMsg,
}: {
  video: VideoRow;
  artists: ArtistOption[];
  releases: ReleaseOption[];
  setMsg: (value: string) => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    title: video.title,
    url: video.url,
    thumbnailUrl: video.thumbnail_url || "",
    artistId: video.artist_id || "",
    releaseId: video.release_id || "",
    sortOrder: String(video.sort_order),
  });

  return (
    <article className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{video.title}</p>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            {video.published ? "Published live" : "Draft"} · order {video.sort_order}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${
          video.published
            ? "bg-[var(--nexo-success-soft)] text-[var(--nexo-success)]"
            : "bg-[var(--nexo-elevated)] text-[var(--nexo-text-muted)]"
        }`}>
          {video.published ? "Live" : "Draft"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
        <Input
          placeholder="Thumbnail URL"
          value={form.thumbnailUrl}
          onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
        />
        <Input
          inputMode="numeric"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />
        <select
          className={selectClass}
          value={form.artistId}
          onChange={(e) => setForm((f) => ({ ...f, artistId: e.target.value }))}
        >
          <option value="">No artist association</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.artist_name || artist.stage_name || artist.id}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={form.releaseId}
          onChange={(e) => setForm((f) => ({ ...f, releaseId: e.target.value }))}
        >
          <option value="">No release association</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title} — {release.primary_artist_name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await upsertWebsiteVideoAction({
                id: video.id,
                title: form.title,
                url: form.url,
                thumbnailUrl: form.thumbnailUrl || null,
                artistId: form.artistId || null,
                releaseId: form.releaseId || null,
                sortOrder: Number(form.sortOrder) || 0,
              });
              setMsg(res.ok ? "Video details saved." : res.error);
            })
          }
        >
          Save changes
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await upsertWebsiteVideoAction({
                id: video.id,
                published: !video.published,
              });
              setMsg(res.ok ? (video.published ? "Video unpublished." : "Video published live.") : res.error);
            })
          }
        >
          {video.published ? "Unpublish" : "Publish"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await upsertWebsiteVideoAction({ id: video.id, delete: true });
              setMsg(res.ok ? "Video deleted." : res.error);
            })
          }
        >
          Delete
        </Button>
      </div>
    </article>
  );
}
