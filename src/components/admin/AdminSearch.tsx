"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminSearch({ initialQ = "" }: { initialQ?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState(initialQ);

  return (
    <form
      className="flex w-full max-w-xl gap-2"
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
        placeholder="Search releases, artists, labels, users…"
        aria-label="Admin search"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
