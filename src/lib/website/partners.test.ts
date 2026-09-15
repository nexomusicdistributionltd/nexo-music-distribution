import { describe, expect, it } from "vitest";
import { sortPartnersByOrder } from "./partner-types";

describe("sortPartnersByOrder", () => {
  it("orders by sort_order then name", () => {
    const rows = [
      { sort_order: 2, name: "Beta" },
      { sort_order: 1, name: "Zed" },
      { sort_order: 1, name: "Alpha" },
    ];
    expect(sortPartnersByOrder(rows).map((r) => r.name)).toEqual([
      "Alpha",
      "Zed",
      "Beta",
    ]);
  });
});
