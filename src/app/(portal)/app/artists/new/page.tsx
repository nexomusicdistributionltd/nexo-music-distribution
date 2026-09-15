import type { Metadata } from "next";
import { RosterArtistForm } from "@/components/roster/RosterArtistForm";
import { RequireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Create artist",
  robots: { index: false, follow: false },
};

export default async function NewRosterArtistPage() {
  await RequireRole("label");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2">Create artist</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Adds a managed artist profile to your roster (no login account created).
        </p>
      </div>
      <RosterArtistForm mode="create" />
    </div>
  );
}
