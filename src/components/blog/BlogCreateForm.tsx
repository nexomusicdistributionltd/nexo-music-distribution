"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/cms/RichTextEditor";
import { upsertBlogPostAction } from "@/app/admin/website/actions";

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
  };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [html, setHtml] = useState(initial?.body_html ?? "<p></p>");
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status === "published" ? "published" : "draft"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
      <Input
        placeholder="Excerpt"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />
      <RichTextEditor valueHtml={html} onChangeHtml={setHtml} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={status === "draft" ? "primary" : "secondary"}
          type="button"
          onClick={() => setStatus("draft")}
        >
          Draft
        </Button>
        <Button
          size="sm"
          variant={status === "published" ? "primary" : "secondary"}
          type="button"
          onClick={() => setStatus("published")}
        >
          Published
        </Button>
        <Button
          disabled={pending || !title.trim()}
          onClick={() =>
            start(async () => {
              const r = await upsertBlogPostAction({
                id: initial?.id,
                title,
                slug: slug || undefined,
                excerpt,
                bodyHtml: html,
                status,
              });
              setMsg(r.ok ? "Saved." : r.error);
            })
          }
        >
          Save
        </Button>
      </div>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
