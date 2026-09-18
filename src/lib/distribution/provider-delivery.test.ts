import { describe, expect, it } from "vitest";
import {
  extractDspDeliveryStatuses,
  normalizeProviderDeliveryPayload,
} from "./provider-delivery";
import { mapProviderStatusToRelease } from "./types";

describe("TooLost delivery normalization", () => {
  it("keeps the provider release status and normalizes store-level delivery rows", () => {
    const result = normalizeProviderDeliveryPayload({
      data: {
        id: 4821,
        status: "Delivered",
        deliveryLog: [
          { store: "Spotify", status: "Completed", updated_at: "2026-09-18T19:00:00Z" },
          { platform: "Apple Music", delivery_status: "Pending" },
          { service: "Amazon Music", status: "Failed", error_message: "Metadata rejected" },
        ],
      },
    });

    expect(result.releaseStatus).toBe("Delivered");
    expect(result.dspStatuses).toEqual([
      { dsp: "Amazon Music", status: "Failed", message: "Metadata rejected" },
      { dsp: "Apple Music", status: "Pending" },
      {
        dsp: "Spotify",
        status: "Completed",
        updatedAt: "2026-09-18T19:00:00Z",
      },
    ]);
  });

  it("does not fabricate DSP status from a list of selected platform names", () => {
    const result = normalizeProviderDeliveryPayload({
      data: {
        release: { status: "Pending" },
        platforms: ["spotify", "apple_music", "amazon_music"],
      },
    });

    expect(result.releaseStatus).toBe("Pending");
    expect(result.dspStatuses).toEqual([]);
  });

  it("extracts an explicit DSP status from a webhook-shaped nested object", () => {
    expect(
      extractDspDeliveryStatuses({
        data: {
          platform: "YouTube Music",
          status: "Processing",
          message: "Awaiting ingestion",
        },
      })
    ).toEqual([
      {
        dsp: "YouTube Music",
        status: "Processing",
        message: "Awaiting ingestion",
      },
    ]);
  });

  it("maps TooLost Pending/In Review/Processing to Nexo delivery-in-progress", () => {
    expect(mapProviderStatusToRelease("Pending")).toBe("delivering");
    expect(mapProviderStatusToRelease("In Review")).toBe("delivering");
    expect(mapProviderStatusToRelease("Processing")).toBe("delivering");
  });

  it("keeps Needs Evidence unmapped rather than pretending it is failed or delivered", () => {
    expect(mapProviderStatusToRelease("Needs Evidence")).toBeNull();
  });
});
