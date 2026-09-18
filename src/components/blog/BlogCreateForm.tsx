"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/cms/RichTextEditor";
import { upsertBlogPostAction } from "@/app/admin/website/actions";
import { uploadCmsMediaAction } from "@/app/admin/website/media-actions";

export function BlogCreateForm({
  initial,
}: {
  initial?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body_html: string;
    status: "draft" | "published" | "archived";
    cover_image_url?: string | null;
    tags?: string[] | null;
  };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [html, setHtml] = useState(initial?.body_html ?? "<p></p>");
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status === "published" ? "published" : "draft"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function uploadCover(file: File | null) {
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
      setCoverImageUrl(result.data?.publicUrl ?? "");
      setMsg("Blog cover uploaded to Nexo CMS media.");
    } finally {
      setUploading(false);
    }
  }

  function save(nextStatus = status) {
    start(async () => {
      const result = await upsertBlogPostAction({
        id: initial?.id,
        title,
        slug: slug || undefined,
        excerpt,
        bodyHtml: html,
        status: nextStatus,
        coverImageUrl: coverImageUrl || undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setStatus(nextStatus);
      setMsg(
        result.ok
          ? nextStatus === "published"
            ? "Blog post published live."
            : "Blog draft saved."
          : result.error
      );
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>
      <Input
        placeholder="Excerpt"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          placeholder="Cover image URL"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
        />
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] px-3 text-caption text-[var(--nexo-text-muted)]">
          {uploading ? "Uploading…" : "Upload blog cover"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={pending || uploading}
            onChange={(e) => uploadCover(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {coverImageUrl ? (
        <div className="max-w-sm overflow-hidden border border-[var(--nexo-border)] bg-[var(--nexo-elevated)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : null}
      <Input
        placeholder="Tags, comma-separated"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <RichTextEditor valueHtml={html} onChangeHtml={setHtml} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending || uploading || !title.trim()}
          onClick={() => save("draft")}
        >
          Save draft
        </Button>
        <Button
          disabled={pending || uploading || !title.trim()}
          onClick={() => save("published")}
        >
          Save & publish
        </Button>
      </div>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
