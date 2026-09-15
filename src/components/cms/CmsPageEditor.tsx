"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/cms/RichTextEditor";
import { upsertCmsPageAction } from "@/app/admin/website/actions";

export function CmsPageEditor({
  page,
}: {
  page: {
    id: string;
    title: string;
    body_html: string;
    status: "draft" | "published" | "archived";
    seo_title: string | null;
    seo_description: string | null;
  };
}) {
  const [title, setTitle] = useState(page.title);
  const [html, setHtml] = useState(page.body_html || "<p></p>");
  const [status, setStatus] = useState<"draft" | "published">(
    page.status === "published" ? "published" : "draft"
  );
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input
        placeholder="SEO title"
        value={seoTitle}
        onChange={(e) => setSeoTitle(e.target.value)}
      />
      <Input
        placeholder="SEO description"
        value={seoDescription}
        onChange={(e) => setSeoDescription(e.target.value)}
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
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await upsertCmsPageAction({
                id: page.id,
                title,
                bodyHtml: html,
                status,
                seoTitle,
                seoDescription,
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
