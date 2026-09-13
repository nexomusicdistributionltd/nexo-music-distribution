import { describe, expect, it } from "vitest";
import { adminStatusLabel, artistStatusLabel, distributionJobStatusLabel } from "./status-labels";
import { statusLabel } from "@/lib/releases/types";

describe("status labels", () => {
  it("maps QC / queue / distributing labels", () => {
    expect(artistStatusLabel("in_qc")).toBe("QC Review");
    expect(artistStatusLabel("scheduled")).toBe("Queued for distribution");
    expect(artistStatusLabel("delivering")).toBe("Distributing");
    expect(artistStatusLabel("failed")).toBe("Failed");
    expect(adminStatusLabel("live")).toBe("Live");
    expect(statusLabel("scheduled")).toBe("Queued for distribution");
    expect(distributionJobStatusLabel("queued")).toBe("Queued");
  });
});
