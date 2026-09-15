"use client";

import * as React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        duplicate?: boolean;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error || "Could not subscribe. Please try again.");
        return;
      }
      setStatus("success");
      setMessage(
        data.duplicate
          ? "You’re already on the list — thank you."
          : "You’re subscribed. Welcome to Nexo updates."
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Could not subscribe. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2" noValidate>
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="Email"
          aria-label="Newsletter email"
          value={email}
          disabled={status === "loading"}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <Button type="submit" disabled={status === "loading"} aria-busy={status === "loading"}>
          {status === "loading" ? "…" : "Join"}
        </Button>
      </div>
      {message ? (
        <p
          className={
            status === "error"
              ? "text-caption text-red-500"
              : "text-caption text-[var(--nexo-text-muted)]"
          }
          role="status"
        >
          {message}
        </p>
      ) : (
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Product and catalog updates. Unsubscribe anytime.
        </p>
      )}
    </form>
  );
}
