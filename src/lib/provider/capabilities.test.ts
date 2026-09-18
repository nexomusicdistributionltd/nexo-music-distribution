import { describe, expect, it } from "vitest";
import {
  distributionCapabilityReport,
  missingDistributionScopes,
  parseDistributionScopes,
} from "./capabilities";

describe("distribution OAuth capabilities", () => {
  it("parses space and comma separated scopes", () => {
    expect([...parseDistributionScopes("read:profile read:sales,write:releases")]).toEqual([
      "read:profile",
      "read:sales",
      "write:releases",
    ]);
  });

  it("requires read:sales for sales reporting", () => {
    const report = distributionCapabilityReport(
      "read:profile read:releases write:releases read:catalog read:analytics"
    );
    expect(report.find((item) => item.key === "sales")?.granted).toBe(false);
    expect(missingDistributionScopes("read:profile")).toContain("read:sales");
  });
});
