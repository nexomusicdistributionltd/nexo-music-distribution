"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  createReleaseDraft,
  prepareAssetUpload,
  registerUploadedAsset,
  replaceContributors,
  replaceTracks,
  submitRelease,
  updateReleaseInfo,
} from "@/app/(portal)/dashboard/releases/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";
import type {
  ContributorRole,
  ReleaseAssetRow,
  ReleaseContributorRow,
  ReleaseRow,
  ReleaseTrackRow,
  ReleaseType,
} from "@/lib/releases/types";
import { ALLOWED_ARTWORK_SIZES, assertArtworkFile, assertAudioFile } from "@/lib/storage/release-assets";

const STEPS = [
  "Type",
  "Info",
  "Tracks",
  "Lyrics",
  "Contributors",
  "Artwork",
  "Rights",
  "Distribution",
  "Review",
] as const;

type TrackDraft = {
  id?: string;
  track_number: number;
  title: string;
  version: string;
  isrc: string;
  explicit: boolean;
  language: string;
  lyrics: string;
};

type ContribDraft = {
  name: string;
  role: ContributorRole;
  share_percent: string;
  track_id: string;
  ipi_cae: string;
  isni: string;
};

export type RosterOption = { id: string; artist_name: string; stage_name: string };

export function ReleaseWizard({
  initial,
  tracks: initialTracks,
  contributors: initialContributors,
  assets: initialAssets,
  mode = "create",
  accountRole = "artist",
  rosterArtists = [],
}: {
  initial?: ReleaseRow | null;
  tracks?: ReleaseTrackRow[];
  contributors?: ReleaseContributorRow[];
  assets?: ReleaseAssetRow[];
  mode?: "create" | "edit";
  accountRole?: "artist" | "label";
  rosterArtists?: RosterOption[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [releaseId, setReleaseId] = React.useState<string | null>(initial?.id ?? null);
  const [type, setType] = React.useState<ReleaseType>(initial?.release_type ?? "single");
  const [rosterArtistId, setRosterArtistId] = React.useState<string>(
    initial?.artist_profile_id ?? ""
  );
  const [info, setInfo] = React.useState({
    title: initial?.title ?? "",
    version: initial?.version ?? "",
    primary_artist_name: initial?.primary_artist_name ?? "",
    genre: initial?.genre ?? "",
    subgenre: initial?.subgenre ?? "",
    language: initial?.language ?? "en",
    release_date: initial?.release_date ?? "",
    original_release_date: initial?.original_release_date ?? "",
    label_name: initial?.label_name ?? "",
    description: initial?.description ?? "",
    explicit: initial?.explicit ?? false,
  });
  const [rights, setRights] = React.useState({
    copyright_year: initial?.copyright_year?.toString() ?? String(new Date().getFullYear()),
    copyright_line: initial?.copyright_line ?? "",
    phonogram_line: initial?.phonogram_line ?? "",
    upc: initial?.upc ?? "",
  });
  const [territories, setTerritories] = React.useState(
    (initial?.territories ?? ["WW"]).join(", ")
  );
  const [tracks, setTracks] = React.useState<TrackDraft[]>(
    initialTracks?.length
      ? initialTracks.map((t) => ({
          id: t.id,
          track_number: t.track_number,
          title: t.title,
          version: t.version ?? "",
          isrc: t.isrc ?? "",
          explicit: t.explicit,
          language: t.language ?? initial?.language ?? "en",
          lyrics: t.lyrics ?? "",
        }))
      : [{
          track_number: 1,
          title: "",
          version: "",
          isrc: "",
          explicit: false,
          language: initial?.language ?? "en",
          lyrics: "",
        }]
  );
  const [contributors, setContributors] = React.useState<ContribDraft[]>(
    initialContributors?.length
      ? initialContributors.map((c) => ({
          name: c.name,
          role: c.role,
          share_percent: c.share_percent?.toString() ?? "",
          track_id: c.track_id ?? "",
          ipi_cae: (c as ReleaseContributorRow).ipi_cae ?? "",
          isni: (c as ReleaseContributorRow).isni ?? "",
        }))
      : [{
          name: initial?.primary_artist_name ?? "",
          role: "primary_artist",
          share_percent: "",
          track_id: "",
          ipi_cae: "",
          isni: "",
        }]
  );
  const [assets, setAssets] = React.useState(initialAssets ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);

  async function ensureDraft(): Promise<string> {
    if (releaseId) return releaseId;
    if (accountRole === "label" && !rosterArtistId) {
      throw new Error("Select a roster artist before creating the release.");
    }
    setBusy(true);
    try {
      const res = await createReleaseDraft({
        release_type: type,
        artist_profile_id: accountRole === "label" ? rosterArtistId : undefined,
      });
      if (!res.ok) throw new Error(res.error);
      setReleaseId(res.data.id);
      return res.data.id;
    } finally {
      setBusy(false);
    }
  }

  async function saveInfo(id: string) {
    const res = await updateReleaseInfo(id, {
      release_type: type,
      title: info.title,
      version: info.version || null,
      primary_artist_name: info.primary_artist_name,
      genre: info.genre || null,
      subgenre: info.subgenre || null,
      language: info.language || null,
      release_date: info.release_date || null,
      original_release_date: info.original_release_date || null,
      label_name: info.label_name || null,
      description: info.description || null,
      explicit: info.explicit,
      copyright_year: rights.copyright_year ? Number(rights.copyright_year) : null,
      copyright_line: rights.copyright_line || null,
      phonogram_line: rights.phonogram_line || null,
      upc: rights.upc || null,
      territories: territories
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      distribution_settings: {
        worldwide: territories.toUpperCase().includes("WW"),
      },
    });
    if (!res.ok) throw new Error(res.error);
  }

  async function saveTracks(id: string) {
    const res = await replaceTracks(
      id,
      tracks.map((t, i) => ({
        id: t.id,
        track_number: i + 1,
        title: t.title,
        version: t.version || null,
        isrc: t.isrc || null,
        explicit: t.explicit,
        language: t.language || null,
        lyrics: t.lyrics || null,
      }))
    );
    if (!res.ok) throw new Error(res.error);
    if (res.data.tracks?.length) {
      setTracks(
        res.data.tracks.map((t) => ({
          id: t.id,
          track_number: t.track_number,
          title: t.title,
          version: t.version ?? "",
          isrc: t.isrc ?? "",
          explicit: t.explicit,
          language: t.language ?? "en",
          lyrics: t.lyrics ?? "",
        }))
      );
    }
  }

  async function saveContributors(id: string) {
    // share_percent is optional ownership metadata only — NOT DDEX DisplayArtist %
    const res = await replaceContributors(
      id,
      contributors
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name,
          role: c.role,
          track_id: c.track_id || null,
          share_percent: c.share_percent ? Number(c.share_percent) : null,
          ipi_cae: c.ipi_cae || null,
          isni: c.isni || null,
        }))
    );
    if (!res.ok) throw new Error(res.error);
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step === 0) {
        const id = await ensureDraft();
        await updateReleaseInfo(id, { release_type: type });
      } else if (step === 1) {
        const id = await ensureDraft();
        await saveInfo(id);
      } else if (step === 2) {
        const id = await ensureDraft();
        await saveTracks(id);
      } else if (step === 3) {
        const id = await ensureDraft();
        await saveTracks(id);
      } else if (step === 4) {
        const id = await ensureDraft();
        await saveContributors(id);
      } else if (step === 6 || step === 7) {
        const id = await ensureDraft();
        await saveInfo(id);
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save step");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(kind: "audio" | "artwork", file: File, trackId?: string) {
    setError(null);
    const check = kind === "audio" ? assertAudioFile(file) : assertArtworkFile(file);
    if (check) {
      setError(check);
      return;
    }
    if (kind === "artwork") {
      try {
        const dimensions = await readImageDimensions(file);
        if (
          dimensions.width !== dimensions.height ||
          !ALLOWED_ARTWORK_SIZES.includes(
            dimensions.width as (typeof ALLOWED_ARTWORK_SIZES)[number]
          )
        ) {
          setError(
            `Artwork must be exactly 1400×1400, 3000×3000, or 4000×4000px. Received ${dimensions.width}×${dimensions.height}px.`
          );
          return;
        }
      } catch {
        setError("Could not read artwork dimensions. Upload a valid JPEG, PNG, or WebP image.");
        return;
      }
    }
    const id = await ensureDraft();
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      const prep = await prepareAssetUpload({ releaseId: id, kind, filename: file.name });
      if (!prep.ok) throw new Error(prep.error);
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(prep.data.bucket)
        .upload(prep.data.path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const reg = await registerUploadedAsset({
        releaseId: id,
        trackId: trackId ?? null,
        kind,
        storagePath: prep.data.path,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!reg.ok) throw new Error(reg.error);
      setAssets((prev) => [
        ...prev.filter((a) => !(kind === "artwork" && a.kind === "artwork")),
        {
          id: reg.data.id,
          release_id: id,
          track_id: trackId ?? null,
          kind,
          storage_bucket: prep.data.bucket,
          storage_path: prep.data.path,
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          checksum: null,
          width: reg.data.width,
          height: reg.data.height,
          codec: reg.data.codec,
          container: reg.data.container,
          sample_rate_hz: reg.data.sample_rate_hz,
          bit_depth: reg.data.bit_depth,
          channels: reg.data.channels,
          duration_ms: reg.data.duration_ms,
          hash_algorithm: null,
          uploaded_by: null,
          created_at: new Date().toISOString(),
        },
      ]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadProgress(null);
    }
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      const id = await ensureDraft();
      await saveInfo(id);
      await saveTracks(id);
      await saveContributors(id);
      const res = await submitRelease(id);
      if (!res.ok) throw new Error(res.error);
      router.push(`/dashboard/releases/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const artwork = assets.find((a) => a.kind === "artwork");
  const audioAssets = assets.filter((a) => a.kind === "audio");

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)] sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Release builder</p><p className="mt-1 text-small text-[var(--nexo-text-secondary)]">Complete the release metadata, audio, contributors, rights and delivery settings before QC submission.</p></div><span className="shrink-0 text-caption font-semibold">{step + 1} / {STEPS.length}</span></div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--nexo-elevated)]"><div className="h-full rounded-full bg-[var(--nexo-text)] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </section>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-caption ${
              i === step
                ? "bg-[var(--nexo-primary)] text-[var(--nexo-primary-fg)]"
                : i < step
                  ? "bg-[var(--nexo-elevated)] text-[var(--nexo-text)]"
                  : "text-[var(--nexo-text-muted)]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error ? (
        <Alert variant="error" title="Could not continue">
          {error}
        </Alert>
      ) : null}
      {uploadProgress ? <Alert title="Upload">{uploadProgress}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(["single", "ep", "album"] as ReleaseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-[var(--nexo-radius-lg)] border p-4 text-left ${
                    type === t
                      ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]"
                      : "border-[var(--nexo-border)]"
                  }`}
                >
                  <p className="font-medium capitalize">{t}</p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {t === "single" ? "1–3 tracks" : t === "ep" ? "2–6 tracks" : "7+ tracks"}
                  </p>
                </button>
              ))}
              {accountRole === "label" ? (
                <div className="sm:col-span-3 space-y-2">
                  <label className="block space-y-1">
                    <span className="text-caption text-[var(--nexo-text-muted)]">Roster artist *</span>
                    <Select
                      value={rosterArtistId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setRosterArtistId(id);
                        const a = rosterArtists.find((r) => r.id === id);
                        if (a) {
                          setInfo((prev) => ({
                            ...prev,
                            primary_artist_name: a.artist_name || a.stage_name,
                          }));
                        }
                      }}
                      disabled={Boolean(releaseId)}
                    >
                      <option value="">Select roster artist…</option>
                      {rosterArtists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.artist_name || a.stage_name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {rosterArtists.length === 0 ? (
                    <p className="text-small text-[var(--nexo-text-muted)]">
                      No roster artists yet.{" "}
                      <Link href="/app/artists/new" className="underline">Create an artist</Link> first.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="sm:col-span-3 text-small text-[var(--nexo-text-muted)]">
                  Artist account: your artist profile is linked automatically.
                </p>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Title</span>
                <Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Version / subtitle</span>
                <Input value={info.version} onChange={(e) => setInfo({ ...info, version: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Primary artist</span>
                <Input
                  value={info.primary_artist_name}
                  onChange={(e) => setInfo({ ...info, primary_artist_name: e.target.value })}
                  readOnly={accountRole === "label"}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Genre</span>
                <Input value={info.genre} onChange={(e) => setInfo({ ...info, genre: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Subgenre</span>
                <Input value={info.subgenre} onChange={(e) => setInfo({ ...info, subgenre: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Language</span>
                <Input value={info.language} onChange={(e) => setInfo({ ...info, language: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Release date</span>
                <Input
                  type="date"
                  value={info.release_date}
                  onChange={(e) => setInfo({ ...info, release_date: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Original release date</span>
                <Input
                  type="date"
                  value={info.original_release_date}
                  onChange={(e) => setInfo({ ...info, original_release_date: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Label name</span>
                <Input
                  value={info.label_name}
                  onChange={(e) => setInfo({ ...info, label_name: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={info.explicit}
                  onChange={(e) => setInfo({ ...info, explicit: e.target.checked })}
                />
                <span className="text-small">Explicit content</span>
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Description</span>
                <Textarea
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-small text-[var(--nexo-text-muted)]">
                Upload a lossless WAV, FLAC, or AIFF master for every track. ISRC is required before distribution and is never fabricated by Nexo.
              </p>
              {tracks.map((t, idx) => (
                <div key={idx} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-small font-medium">Track {idx + 1}</p>
                    {tracks.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTracks(tracks.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder="Title"
                    value={t.title}
                    onChange={(e) => {
                      const next = [...tracks];
                      next[idx] = { ...t, title: e.target.value };
                      setTracks(next);
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Version"
                      value={t.version}
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, version: e.target.value };
                        setTracks(next);
                      }}
                    />
                    <Input
                      placeholder="ISRC (optional)"
                      value={t.isrc}
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, isrc: e.target.value.toUpperCase() };
                        setTracks(next);
                      }}
                    />
                  </div>
                  <Input
                    placeholder="Track language (ISO code, e.g. en)"
                    value={t.language}
                    onChange={(e) => {
                      const next = [...tracks];
                      next[idx] = { ...t, language: e.target.value };
                      setTracks(next);
                    }}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={t.explicit}
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, explicit: e.target.checked };
                        setTracks(next);
                      }}
                    />
                    <span className="text-small">Explicit</span>
                  </label>
                  <div>
                    <label className="text-caption text-[var(--nexo-text-muted)]">Audio file</label>
                    <Input
                      type="file"
                      accept="audio/flac,audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,.flac,.wav,.aif,.aiff"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onUpload("audio", f, t.id);
                      }}
                    />
                    {audioAssets.length ? (
                      <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                        {audioAssets.length} audio file(s) on release — replace before submit if needed.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTracks([
                    ...tracks,
                    {
                      track_number: tracks.length + 1,
                      title: "",
                      version: "",
                      isrc: "",
                      explicit: false,
                      language: info.language || "en",
                      lyrics: "",
                    },
                  ])
                }
              >
                Add track
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-h4">Lyrics</h3>
                <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
                  Add the exact lyrics for each track. Leave instrumental tracks blank. Lyrics are stored with the track metadata and are never generated.
                </p>
              </div>
              {tracks.map((t, idx) => (
                <label key={t.id ?? idx} className="block space-y-1">
                  <span className="text-caption text-[var(--nexo-text-muted)]">
                    Track {idx + 1}{t.title ? `: ${t.title}` : ""}
                  </span>
                  <Textarea
                    rows={10}
                    placeholder="Enter lyrics exactly as performed…"
                    value={t.lyrics}
                    onChange={(e) => {
                      const next = [...tracks];
                      next[idx] = { ...t, lyrics: e.target.value };
                      setTracks(next);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <p className="text-small text-[var(--nexo-text-muted)]">
                Assign each contributor to the whole release or a specific track. Share % is optional
                ownership metadata only — not a DDEX DisplayArtist percentage.
              </p>
              {contributors.map((c, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, name: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Select
                    value={c.role}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, role: e.target.value as ContributorRole };
                      setContributors(next);
                    }}
                  >
                    {[
                      "primary_artist",
                      "featured_artist",
                      "producer",
                      "songwriter",
                      "composer",
                      "lyricist",
                      "mixer",
                      "engineer",
                      "publisher",
                      "remixer",
                      "other",
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={c.track_id}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, track_id: e.target.value };
                      setContributors(next);
                    }}
                  >
                    <option value="">Entire release</option>
                    {tracks.map((t, ti) => (
                      <option key={t.id ?? `t${ti}`} value={t.id ?? ""} disabled={!t.id}>
                        Track {ti + 1}{t.title ? `: ${t.title}` : ""}{!t.id ? " (save tracks first)" : ""}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Share % (optional metadata)"
                    value={c.share_percent}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, share_percent: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Input
                    placeholder="IPI/CAE (optional)"
                    value={c.ipi_cae}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, ipi_cae: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Input
                    placeholder="ISNI (optional)"
                    value={c.isni}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, isni: e.target.value };
                      setContributors(next);
                    }}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setContributors([
                    ...contributors,
                    { name: "", role: "other", share_percent: "", track_id: "", ipi_cae: "", isni: "" },
                  ])
                }
              >
                Add contributor
              </Button>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3">
              <p className="text-small text-[var(--nexo-text-muted)]">
                Cover art must be square and exactly 1400×1400, 3000×3000, or 4000×4000px (JPEG/PNG/WebP). Invalid dimensions are rejected before upload.
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload("artwork", f);
                }}
              />
              {artwork ? (
                <p className="text-small">
                  Current: <span className="font-medium">{artwork.filename}</span> (replace anytime before
                  submit)
                </p>
              ) : (
                <p className="text-small text-[var(--nexo-text-muted)]">No artwork uploaded yet.</p>
              )}
            </div>
          ) : null}

          {step === 6 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Copyright year</span>
                <Input
                  value={rights.copyright_year}
                  onChange={(e) => setRights({ ...rights, copyright_year: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">UPC (required before distribution — never fabricated)</span>
                <Input
                  value={rights.upc}
                  onChange={(e) => setRights({ ...rights, upc: e.target.value })}
                  placeholder="12–14 digits if you have one"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Copyright line (C)</span>
                <Input
                  value={rights.copyright_line}
                  onChange={(e) => setRights({ ...rights, copyright_line: e.target.value })}
                  placeholder="© 2026 Artist Name"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Phonogram line (P)</span>
                <Input
                  value={rights.phonogram_line}
                  onChange={(e) => setRights({ ...rights, phonogram_line: e.target.value })}
                  placeholder="℗ 2026 Artist Name"
                />
              </label>
            </div>
          ) : null}

          {step === 7 ? (
            <div className="space-y-3">
              <Alert title="Distribution">
                Nexo manages delivery after your release passes quality control.
              </Alert>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">
                  Territories (comma-separated ISO codes, or WW)
                </span>
                <Input value={territories} onChange={(e) => setTerritories(e.target.value)} />
              </label>
            </div>
          ) : null}

          {step === 8 ? (
            <div className="space-y-3 text-small">
              <p>
                <strong>Type:</strong> {type}
              </p>
              <p>
                <strong>Title:</strong> {info.title || "—"}
              </p>
              <p>
                <strong>Artist:</strong> {info.primary_artist_name || "—"}
              </p>
              <p>
                <strong>Tracks:</strong> {tracks.length}
              </p>
              <p>
                <strong>Artwork:</strong> {artwork ? artwork.filename : "Missing"}
              </p>
              <p>
                <strong>Audio files:</strong> {audioAssets.length}
              </p>
              <p>
                <strong>UPC:</strong> {rights.upc || "Not provided"}
              </p>
              <Alert title="Submit to QC">
                Submitting locks this release. You cannot self-approve or mark it delivered/live.
              </Alert>
            </div>
          ) : null}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => void next()} disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            ) : (
              <Button onClick={() => void onSubmit()} disabled={busy}>
                {busy ? "Submitting…" : mode === "edit" ? "Save & submit to QC" : "Submit to QC"}
              </Button>
            )}
          </div>
          {releaseId ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Draft ID: {releaseId} — you can leave and resume from catalog.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(url);
      if (!width || !height) {
        reject(new Error("Invalid image dimensions"));
        return;
      }
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    image.src = url;
  });
}
