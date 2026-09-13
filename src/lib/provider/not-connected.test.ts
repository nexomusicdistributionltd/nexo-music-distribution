import { describe, expect, it } from "vitest";
import { NotConnectedProvider } from "./not-connected";
import { ProviderNotConnectedError } from "./errors";

describe("NotConnectedProvider", () => {
  const p = new NotConnectedProvider();

  it("is not connected", () => {
    expect(p.connected).toBe(false);
    expect(p.name).toBe("not_connected");
  });

  it("throws clear not-connected on all operations (no fake delivery)", async () => {
    await expect(
      p.submitRelease({
        releaseId: "r1",
        title: "t",
        type: "single",
        primaryArtistName: "a",
        tracks: [],
      })
    ).rejects.toBeInstanceOf(ProviderNotConnectedError);

    await expect(p.getDeliveryStatus("x")).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONNECTED",
    });
    await expect(p.syncRelease("x")).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.handleWebhook({ type: "x", payload: {}, receivedAt: "" })).rejects.toBeInstanceOf(
      ProviderNotConnectedError
    );
    await expect(p.reinstateRelease("x")).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.requestTakedown("x")).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.updateRelease("x", {})).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.getReleaseStatus("x")).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.getCatalog({})).rejects.toBeInstanceOf(ProviderNotConnectedError);
  });
});
