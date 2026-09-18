"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { ReleaseRow, ReleaseType } from "@/lib/releases/types";
import {
  updateAdminReleaseMetadataAction,
  type AdminReleaseMetadataPatch,
} from "@/app/admin/releases/[releaseId]/actions";

const inputClass =
  "h-10 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 text-small outline-none focus:border-[var(--nexo-accent)]";
const textareaClass =
  "min-h-24 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small outline-none focus:border-[var(--nexo-accent)]";

type EditableRelease = Pick<
  ReleaseRow,
  | "id"
  | "status"
  | "release_type"
  | "title"
  | "version"
  | "primary_artist_name"
  | "genre"
  | "subgenre"
  | "language"
  | "release_date"
  | "original_release_date"
  | "label_name"
  | "copyright_year"
  | "copyright_line"
  | "phonogram_line"
  | "upc"
  | "explicit"
  | "description"
  | "territories"
  | "provider_release_id"
>;

export function AdminReleaseMetadataForm({ release }: { release: EditableRelease }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [form, setForm] = useState({
    release_type: release.release_type,
    title: release.title ?? "",
    version: release.version ?? "",
    primary_artist_name: release.primary_artist_name ?? "",
    genre: release.genre ?? "",
    subgenre: release.subgenre ?? "",
    language: release.language ?? "",
    release_date: release.release_date ?? "",
    original_release_date: release.original_release_date ?? "",
    label_name: release.label_name ?? "",
    copyright_year: release.copyright_year?.toString() ?? "",
    copyright_line: release.copyright_line ?? "",
    phonogram_line: release.phonogram_line ?? "",
    upc: release.upc ?? "",
    explicit: Boolean(release.explicit),
    description: release.description ?? "",
    territories: (release.territories ?? ["WW"]).join(", "),
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setMessage(null);
    setWarning(null);

    const patch: AdminReleaseMetadataPatch = {
      release_type: form.release_type as ReleaseType,
      title: form.title,
      version: form.version || null,
      primary_artist_name: form.primary_artist_name,
      genre: form.genre || null,
      subgenre: form.subgenre || null,
      language: form.language || null,
      release_date: form.release_date || null,
      original_release_date: form.original_release_date || null,
      label_name: form.label_name || null,
      copyright_year: form.copyright_year ? Number(form.copyright_year) : null,
      copyright_line: form.copyright_line || null,
      phonogram_line: form.phonogram_line || null,
      upc: form.upc || null,
      explicit: form.explicit,
      description: form.description || null,
      territories: form.territories
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      const result = await updateAdminReleaseMetadataAction(release.id, patch);
      if (!result.ok) {
        setWarning(result.error);
        return;
      }
      setMessage(
        result.data.providerSynced
          ? "Metadata saved in Nexo and synchronized to TooLost."
          : "Metadata saved in Nexo."
      );
      setWarning(result.data.providerWarning ?? null);
      router.refresh();
    });
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type: "text" | "date" | "number" = "text"
  ) => (
    <label className="space-y-1.5">
      <span className="text-label">{label}</span>
      <input
        className={inputClass}
        type={type}
        value={String(form[key] ?? "")}
        onChange={(event) => update(key as never, event.target.value as never)}
      />
    </label>
  );

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Admin metadata editor</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Staff-only corrections for draft, submitted, QC, approved, rejected or failed releases.
          {release.provider_release_id
            ? " This release already exists upstream, so only fields supported by the provider update route can be changed."
            : " No TooLost release ID exists yet, so corrections remain local until distribution submission."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-label">Release type</span>
          <select
            className={inputClass}
            value={form.release_type}
            onChange={(event) => update("release_type", event.target.value as ReleaseType)}
          >
            <option value="single">Single</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
          </select>
        </label>
        {field("Title", "title")}
        {field("Version", "version")}
        {field("Primary artist", "primary_artist_name")}
        {field("Label", "label_name")}
        {field("UPC", "upc")}
        {field("Genre", "genre")}
        {field("Subgenre", "subgenre")}
        {field("Language", "language")}
        {field("Release date", "release_date", "date")}
        {field("Original release date", "original_release_date", "date")}
        {field("Copyright year", "copyright_year", "number")}
        {field("Copyright line", "copyright_line")}
        {field("Phonogram line", "phonogram_line")}
        {field("Territories (comma separated)", "territories")}
      </div>

      <label className="flex items-center gap-2 text-small">
        <input
          type="checkbox"
          checked={form.explicit}
          onChange={(event) => update("explicit", event.target.checked)}
        />
        Explicit content
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">Description</span>
        <textarea
          className={textareaClass}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>

      {message ? <Alert variant="success" title="Saved">{message}</Alert> : null}
      {warning ? <Alert variant="warning" title="Attention">{warning}</Alert> : null}

      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save metadata"}
      </Button>
    </section>
  );
}
