import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
const root = join(__dirname, "../../..");
describe("roster policy", () => {
  it("actions + migration invariants", () => {
    const src = readFileSync(join(root, "src/app/(portal)/app/artists/actions.ts"), "utf8");
    expect(src).toContain('rpc("create_label_roster_artist_with_dsp"');
    const atomic = readFileSync(join(root, "supabase/migrations/20260918172000_atomic_roster_artist_dsp.sql"), "utf8");
    expect(atomic).toMatch(/insert into public\.artist_profiles[\s\S]*values\(\s*null, null,/i);
    expect(src).not.toMatch(/\.from\(["']user_roles["']\)\s*\.insert/);
    const mig = readFileSync(join(root, "supabase/migrations/20260915400001_ddex_foundation_label_roster.sql"), "utf8");
    expect(mig).toMatch(/user_id drop not null/i);
    expect(mig).toMatch(/label_roster_artists/);
    expect(mig).toMatch(/ddex_messages/);
    const page = readFileSync(join(root, "src/app/(portal)/app/artists/page.tsx"), "utf8");
    expect(page).not.toContain("ComingSoon");
    const actions = readFileSync(join(root, "src/app/(portal)/dashboard/releases/actions.ts"), "utf8");
    expect(actions).toContain("Select a roster artist before creating a release");
    expect(actions).toContain("Mixed artist/label roles are not allowed.");
    expect(actions).toContain("label_profile_id: labelProfileId");
    expect(actions).toContain("artist_profile_id: artistProfileId");
    expect(src).toContain("Does NOT mutate profiles.account_type (Label stays Label)");
    const wiz = readFileSync(join(root, "src/components/releases/ReleaseWizard.tsx"), "utf8");
    expect(wiz).toContain("rosterArtistId");
    expect(wiz).toContain("track_id");
  });
});
