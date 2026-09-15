import { describe, expect, it } from "vitest";
import { filterPublishedPosts } from "./queries";

describe("filterPublishedPosts", () => {
  it("only returns published", () => {
    const rows = [
      { status: "draft" },
      { status: "published" },
      { status: "archived" },
    ];
    expect(filterPublishedPosts(rows)).toEqual([{ status: "published" }]);
  });
});
