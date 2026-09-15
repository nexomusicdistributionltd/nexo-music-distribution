"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { upsertWebsiteVideoAction } from "@/app/admin/website/actions";

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

export function VideosAdminClient({ videos }: { videos: VideoRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    url: "",
    thumbnailUrl: "",
    artistId: "",
    releaseId: "",
    sortOrder: "0",
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
        <h2 className="text-h4">Add video</h2>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          External hosts only — Nexo does not download or re-host video files. Public pages
          label these as external sources.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Input
            placeholder="URL (YouTube / Vimeo / etc.)"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          />
          <Input
            placeholder="Thumbnail URL (optional)"
            value={draft.thumbnailUrl}
            onChange={(e) => setDraft((d) => ({ ...d, thumbnailUrl: e.target.value }))}
          />
          <Input
            placeholder="Artist profile UUID (optional)"
            value={draft.artistId}
            onChange={(e) => setDraft((d) => ({ ...d, artistId: e.target.value }))}
          />
          <Input
            placeholder="Release UUID (optional)"
            value={draft.releaseId}
            onChange={(e) => setDraft((d) => ({ ...d, releaseId: e.target.value }))}
          />
          <Input
            placeholder="Sort order"
            value={draft.sortOrder}
            onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
          />
        </div>
        <Button
          disabled={pending}
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
              setMsg(res.ok ? "Video created (draft)." : res.error);
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
          Create
        </Button>
      </section>

      <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        {videos.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-small">
            <div>
              <p className="font-medium">{v.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                published={String(v.published)} · {v.url}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await upsertWebsiteVideoAction({
                      id: v.id,
                      published: !v.published,
                    });
                    setMsg(res.ok ? "Publish toggled." : res.error);
                  })
                }
              >
                {v.published ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await upsertWebsiteVideoAction({ id: v.id, delete: true });
                    setMsg(res.ok ? "Deleted." : res.error);
                  })
                }
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
