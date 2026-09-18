"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { COUNTRIES } from "@/lib/auth/countries";
import { friendlyAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export type EditableLabelProfile = {
  id: string;
  label_name: string;
  contact_name: string | null;
  business_email: string | null;
  website: string | null;
  legal_business_name: string | null;
  logo_url: string | null;
  description: string | null;
  country: string | null;
};

export function LabelProfileForm({ label }: { label: EditableLabelProfile }) {
  const router = useRouter();
  const [labelName, setLabelName] = React.useState(label.label_name ?? "");
  const [legalName, setLegalName] = React.useState(label.legal_business_name ?? "");
  const [contactName, setContactName] = React.useState(label.contact_name ?? "");
  const [businessEmail, setBusinessEmail] = React.useState(label.business_email ?? "");
  const [website, setWebsite] = React.useState(label.website ?? "");
  const [country, setCountry] = React.useState(label.country ?? "");
  const [description, setDescription] = React.useState(label.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanLabelName = labelName.trim();
    if (!cleanLabelName) {
      setError("Label name is required.");
      return;
    }

    const cleanEmail = businessEmail.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid business email.");
      return;
    }

    const cleanWebsite = website.trim();
    if (cleanWebsite) {
      try {
        const url = new URL(cleanWebsite);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      } catch {
        setError("Website must be a valid http:// or https:// URL.");
        return;
      }
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const fields = {
        label_name: cleanLabelName,
        legal_business_name: legalName.trim() || null,
        contact_name: contactName.trim() || null,
        business_email: cleanEmail || null,
        website: cleanWebsite || null,
        country: country || null,
        description: description.trim() || null,
      };
      const { error: updateError } = await supabase
        .from("label_profiles")
        .update(fields)
        .eq("id", label.id);
      if (updateError) throw updateError;

      try {
        await supabase.rpc("write_audit_log", {
          p_action: "label_profile_update",
          p_entity_type: "label_profile",
          p_entity_id: label.id,
          p_metadata: { fields: Object.keys(fields) },
        });
      } catch {
        /* audit logging must not block a valid profile update */
      }

      setSuccess("Label profile saved.");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err, "Could not save label profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="mx-auto max-w-2xl space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
    >
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
          Label business profile
        </p>
        <h2 className="mt-1 text-h4">Label details</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          These fields identify the label in Nexo catalog and distribution workflows. Account roles and sign-in details are managed separately.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <label className="block space-y-1.5">
        <span className="text-label">Label name *</span>
        <Input value={labelName} onChange={(event) => setLabelName(event.target.value)} required />
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">Legal business name</span>
        <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-label">Contact name</span>
          <Input value={contactName} onChange={(event) => setContactName(event.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label">Business email</span>
          <Input
            type="email"
            value={businessEmail}
            onChange={(event) => setBusinessEmail(event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-label">Website</span>
        <Input
          type="url"
          placeholder="https://example.com"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">Country</span>
        <Select value={country} onChange={(event) => setCountry(event.target.value)}>
          <option value="">Select country</option>
          {COUNTRIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-label">Label description</span>
        <Textarea
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the label, roster and catalog."
        />
      </label>

      <Button type="submit" className="rounded-full" disabled={saving}>
        {saving ? "Saving…" : "Save label details"}
      </Button>
    </form>
  );
}
