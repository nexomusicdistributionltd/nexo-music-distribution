import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("label workspace and distribution handoff", () => {
  it("renders label-specific operational intelligence from real account data", () => {
    const dashboard = read("src/app/(portal)/dashboard/page.tsx");
    const panel = read("src/components/portal/LabelOverviewPanel.tsx");

    expect(dashboard).toContain("LabelOverviewPanel");
    expect(dashboard).toContain("getReleaseCounts");
    expect(dashboard).toContain("countReleasesForArtists");
    expect(panel).toContain("Label operations");
    expect(panel).toContain("/sales");
    expect(panel).toContain("/earnings/payouts");
  });

  it("keeps label releases bound to a verified roster artist", () => {
    const page = read("src/app/(portal)/dashboard/releases/new/page.tsx");
    const wizard = read("src/components/releases/ReleaseWizard.tsx");
    const actions = read("src/app/(portal)/dashboard/releases/actions.ts");

    expect(page).toContain("initialArtistProfileId");
    expect(page).toContain("rosterArtists.some");
    expect(wizard).toContain("initialArtistProfileId");
    expect(wizard).toContain("seededRosterArtist");
    expect(actions).toContain("Selected artist is not on your roster.");
    expect(actions).toContain("label_name: defaultLabelName");
  });

  it("exposes label business identity without making roles editable", () => {
    const profilePage = read("src/app/(portal)/dashboard/profile/page.tsx");
    const labelForm = read("src/components/auth/LabelProfileForm.tsx");

    expect(profilePage).toContain("LabelProfileForm");
    expect(labelForm).toContain('.from("label_profiles")');
    expect(labelForm).toContain("legal_business_name");
    expect(labelForm).not.toContain("user_roles");
    expect(labelForm).not.toContain("account_type");
  });

  it("provides direct artist-scoped release creation from the label roster", () => {
    const roster = read("src/app/(portal)/app/artists/page.tsx");
    const artist = read("src/app/(portal)/app/artists/[artistId]/page.tsx");

    expect(roster).toContain("/dashboard/releases/new?artist=");
    expect(artist).toContain("/dashboard/releases/new?artist=");
  });
});
