"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";

export function ContactForm() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setPending(true);
        setError(null);
        setDone(false);
        const fd = new FormData(e.currentTarget);
        const payload = {
          name: String(fd.get("name") || ""),
          email: String(fd.get("email") || ""),
          subject: String(fd.get("subject") || ""),
          message: String(fd.get("message") || ""),
        };
        try {
          const res = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await res.json()) as { ok: boolean; error?: string };
          if (!res.ok || !json.ok) {
            setError(json.error || "Could not send message.");
          } else {
            setDone(true);
            form.reset();
          }
        } catch {
          setError("Network error.");
        }
        setPending(false);
      }}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-label text-[var(--nexo-text)]">Name</span>
          <Input name="name" autoComplete="name" placeholder="Your name" required disabled={pending} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-label text-[var(--nexo-text)]">Email</span>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={pending}
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-label text-[var(--nexo-text)]">Subject</span>
        <Input name="subject" placeholder="How can we help?" required disabled={pending} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-label text-[var(--nexo-text)]">Message</span>
        <Textarea
          name="message"
          rows={5}
          placeholder="Tell us about your project"
          required
          disabled={pending}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>

      {error ? (
        <Alert variant="warning" title="Not sent">
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert title="Received">
          Your message was stored in the contact inbox. We will follow up by email.
        </Alert>
      ) : null}
    </form>
  );
}
