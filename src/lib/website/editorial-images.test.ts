import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  EDITORIAL_ATTRIBUTION_PATH,
  editorialImagePaths,
  HOMEPAGE_IMAGE_DEFAULTS,
  HOMEPAGE_IMAGE_PRESETS,
} from "./homepage-images";

const publicRoot = join(process.cwd(), "public");

describe("editorial imagery", () => {
  it("attribution file exists under public/images/editorial", () => {
    const rel = EDITORIAL_ATTRIBUTION_PATH.replace(/^\//, "");
    expect(existsSync(join(publicRoot, rel))).toBe(true);
  });

  it("all editorial preset files exist", () => {
    for (const path of editorialImagePaths()) {
      const rel = path.replace(/^\//, "");
      expect(existsSync(join(publicRoot, rel)), path).toBe(true);
    }
  });

  it("homepage defaults prefer editorial human/music presets", () => {
    expect(HOMEPAGE_IMAGE_DEFAULTS.hero_image_url).toBe("singer");
    expect(HOMEPAGE_IMAGE_PRESETS.singer).toContain("/images/editorial/");
    expect(HOMEPAGE_IMAGE_DEFAULTS.artists_image_url).toBe("live");
  });
});
