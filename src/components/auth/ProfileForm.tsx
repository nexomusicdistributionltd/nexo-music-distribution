"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VerifiedBadge } from "@/components/verification/VerifiedBadge";
import { COUNTRIES } from "@/lib/auth/countries";
import { friendlyAuthError } from "@/lib/auth/errors";
import type { AccountStatus, AppRole, Profile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

function statusKind(status: AccountStatus): "live" | "pending" | "rejected" | "draft" {
  if (status === "active") return "live";
  if (status === "pending_verification") return "pending";
  if (status === "suspended" || status === "deactivated") return "rejected";
  return "draft";
}

export function ProfileForm({
  profile,
  roles,
  email,
}: {
  profile: Profile;
  roles: AppRole[];
  email: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.full_name);
  const [displayName, setDisplayName] = React.useState(profile.display_name);
  const [country, setCountry] = React.useState(profile.country ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const accountTypeLabel = roles[0] ?? profile.account_type;
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          display_name: displayName.trim(),
          country: country || null,
        })
        .eq("id", profile.id);
      if (updateError) throw updateError;

      try {
        await supabase.rpc("write_audit_log", {
          p_action: "profile_update",
          p_entity_type: "profile",
          p_entity_id: profile.id,
          p_metadata: { fields: ["full_name", "display_name", "country"] },
        });
      } catch {
        /* ignore audit errors */
      }

      setSuccess("Profile saved.");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err, "Could not save profile."));
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setSuccess("Avatar updated.");
      router.refresh();
    } catch (err) {
      setError(
        friendlyAuthError(
          err,
          "Could not upload avatar. Ensure the avatars storage bucket exists in Supabase."
        )
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:flex-row sm:items-center">
        <Avatar name={displayName || fullName || email} src={avatarUrl ?? undefined} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-h3 truncate">{displayName || fullName || "Your profile"}</h1>
          <p className="mt-1 truncate text-small text-[var(--nexo-text-muted)]">{email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={statusKind(profile.account_status)}
              label={profile.account_status.replace(/_/g, " ")}
            />
            <span className="text-caption capitalize text-[var(--nexo-text-muted)]">
              {accountTypeLabel.replace(/_/g, " ")}
            </span>
            {profile.identity_verified_at ? <VerifiedBadge compact /> : null}
          </div>
        </div>
        <div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--nexo-outline-border)] px-3 py-1.5 text-[length:0.75rem] font-medium text-[var(--nexo-outline-fg)] hover:bg-[var(--nexo-outline-hover)]">
            <span>{uploading ? "Uploading…" : "Upload avatar"}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onAvatarChange}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <dl className="grid gap-3 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 text-small sm:grid-cols-2">
        <div>
          <dt className="text-caption text-[var(--nexo-text-muted)]">Account type</dt>
          <dd className="mt-0.5 capitalize">{accountTypeLabel.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--nexo-text-muted)]">Country</dt>
          <dd className="mt-0.5">{profile.country || "—"}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--nexo-text-muted)]">Member since</dt>
          <dd className="mt-0.5">{memberSince}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--nexo-text-muted)]">Status</dt>
          <dd className="mt-0.5 capitalize">{profile.account_status.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-caption text-[var(--nexo-text-muted)]">Identity</dt>
          <dd className="mt-0.5">
            {profile.identity_verified_at ? (
              <VerifiedBadge />
            ) : (
              <Link href="/verification" className="underline underline-offset-4">
                Verification required
              </Link>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-caption text-[var(--nexo-text-muted)]">Role</dt>
          <dd className="mt-0.5 text-[var(--nexo-text-secondary)]">
            {roles.map((r) => r.replace(/_/g, " ")).join(", ") || "—"}{" "}
            <span className="text-caption">(managed by Nexo — not editable)</span>
          </dd>
        </div>
      </dl>

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
      >
        <h2 className="text-h4">Edit profile</h2>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <label className="block space-y-1.5">
          <span className="text-label">Full name</span>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label">Display name</span>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label">Email</span>
          <Input value={email} disabled readOnly />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label">Country</span>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>

        <Button type="submit" className="rounded-full" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
        <h2 className="text-h4">Security</h2>
        <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
          Change your password via a secure reset email. We never display or store password values
          in the app.
        </p>
        <div className="mt-4">
          <Link href="/forgot-password">
            <Button type="button" variant="outline" className="rounded-full">
              Reset password
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
