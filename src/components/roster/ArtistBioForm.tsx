"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { saveArtistBioAction } from "@/app/(portal)/app/artists/dsp-actions";

export function ArtistBioForm({
  artistProfileId,
  initialBio,
}: {
  artistProfileId: string;
  initialBio: string | null;
}) {
  const router = useRouter();
  const [bio, setBio] = React.useState(initialBio ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const res = await saveArtistBioAction({ artistProfileId, bio });
        setPending(false);
        if (!res.ok) setError(res.error);
        else {
          setOk(true);
          router.refresh();
        }
      }}
    >
      <h2 className="text-h4">Artist bio</h2>
      <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} aria-label="Artist bio" />
      {error ? (
        <Alert variant="warning" title="Not saved">
          {error}
        </Alert>
      ) : null}
      {ok ? <p className="text-caption text-[var(--nexo-text-muted)]">Bio saved.</p> : null}
      <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save bio"}
      </Button>
    </form>
  );
}
