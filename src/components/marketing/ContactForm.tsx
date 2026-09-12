"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";

export function ContactForm() {
  const [attempted, setAttempted] = React.useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setAttempted(true);
      }}
      noValidate
    >
      <Alert title="Form delivery requires configuration">
        This contact form is a complete UI. Message delivery is not connected yet —
        submit is disabled until a backend endpoint or email service is configured.
        Prefer emailing via the contact details on this page when available, or use
        Get Started for onboarding interest.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-label text-[var(--nexo-text)]">Name</span>
          <Input name="name" autoComplete="name" placeholder="Your name" disabled />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label text-[var(--nexo-text)]">Email</span>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-label text-[var(--nexo-text)]">Subject</span>
        <Input name="subject" placeholder="How can we help?" disabled />
      </label>
      <label className="block space-y-1.5">
        <span className="text-label text-[var(--nexo-text)]">Message</span>
        <Textarea name="message" rows={5} placeholder="Tell us about your project" disabled />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled title="Backend not configured">
          Send message (disabled)
        </Button>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Honest state: no fake success messages.
        </p>
      </div>

      {attempted ? (
        <Alert variant="warning" title="Not sent">
          Delivery is not configured in this build.
        </Alert>
      ) : null}
    </form>
  );
}
