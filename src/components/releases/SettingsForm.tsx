"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { updateSettings } from "@/app/(portal)/dashboard/settings/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { COUNTRIES } from "@/lib/auth/countries";
import type { Profile } from "@/lib/auth/types";

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Africa/Lagos",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.full_name);
  const [displayName, setDisplayName] = React.useState(profile.display_name);
  const [country, setCountry] = React.useState(profile.country ?? "");
  const [timezone, setTimezone] = React.useState(profile.timezone ?? "UTC");
  const [language, setLanguage] = React.useState(profile.language ?? "en");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateSettings({
        full_name: fullName,
        display_name: displayName,
        country: country || null,
        timezone,
        language,
      });
      if (!res.ok) throw new Error(res.error);
      setSuccess("Settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-xl space-y-4">
      {error ? (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      ) : null}
      {success ? <Alert title="Saved">{success}</Alert> : null}
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Full name</span>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Display name</span>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Country</span>
        <Select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Timezone</span>
        <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {TIMEZONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Language</span>
        <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </label>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Role and account status are not editable here. Avatar uploads remain on the Profile page.
      </p>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
