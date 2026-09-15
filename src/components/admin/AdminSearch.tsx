"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminSearch({
  initialQ = "",
  compact = false,
}: {
  initialQ?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState(initialQ);

  return (
    <form
      className={compact ? "flex w-full gap-2" : "flex w-full max-w-xl gap-2"}
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = q.trim();
        if (!trimmed) {
          router.push("/admin");
          return;
        }
        router.push(`/admin/search?q=${encodeURIComponent(trimmed)}`);
      }}
      role="search"
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Search catalog…" : "Search releases, artists, labels, users…"}
        aria-label="Admin search"
        className={compact ? "h-9" : undefined}
      />
      {compact ? null : (
        <Button type="submit" variant="secondary">
          Search
        </Button>
      )}
    </form>
  );
}
