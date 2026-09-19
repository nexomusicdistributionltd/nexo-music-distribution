import { describe, expect, it } from "vitest";
import { diagnoseDeliveryFailure } from "./delivery-diagnostics";

describe("delivery failure diagnostics", () => {
  it("points license errors to the licensing field", () => {
    const d = diagnoseDeliveryFailure(
      "Nexo delivery validation failed at release metadata (HTTP 422): The selected license type is invalid."
    );
    expect(d.summary).toMatch(/Licensing/i);
    expect(d.field).toBe("License type");
    expect(d.where).toMatch(/License type/i);
    expect(d.nextAction).toMatch(/retry/i);
  });

  it("points language failures to language metadata", () => {
    const d = diagnoseDeliveryFailure(
      "Nexo delivery validation failed at release metadata (HTTP 422): language: invalid value"
    );
    expect(d.field).toBe("Language");
    expect(d.where).toMatch(/Language/i);
    expect(d.owner).toBe("artist_or_label");
  });

  it("points a numbered FLAC failure to that track", () => {
    const d = diagnoseDeliveryFailure(
      "Track 2 must use lossless FLAC audio for Nexo delivery."
    );
    expect(d.where).toContain("Track 2");
    expect(d.summary).toMatch(/Audio/i);
  });

  it("does not send provider outages back to the artist", () => {
    const d = diagnoseDeliveryFailure(
      "Nexo delivery validation failed at provider request (HTTP 503): temporarily unavailable"
    );
    expect(d.owner).toBe("system");
    expect(d.nextAction).toMatch(/Do not return/i);
  });
});
