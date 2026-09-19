import { describe, expect, it } from "vitest";
import {
  normalizeProviderLanguage,
  normalizeProviderLicenseType,
  normalizeProviderReleaseTime,
  normalizeProviderMinuteSecond,
  normalizeProviderTimeZone,
  normalizeProviderText,
  normalizeRightsText,
} from "./metadata-normalization";

describe("TooLost outbound metadata normalization", () => {
  it("omits provider-default Copyright and preserves Creative Commons for API metadata", () => {
    expect(normalizeProviderLicenseType("Copyright")).toBeUndefined();
    expect(normalizeProviderLicenseType("(c)")).toBeUndefined();
    expect(normalizeProviderLicenseType("Creative Commons")).toBe("Creative Commons");
    expect(normalizeProviderLicenseType("cc")).toBe("Creative Commons");
  });

  it("normalizes common language names and whitespace", () => {
    expect(normalizeProviderLanguage("portuguese ")).toBe("pt");
    expect(normalizeProviderLanguage("English")).toBe("en");
    expect(normalizeProviderLanguage("zxx")).toBe("zxx");
  });

  it("normalizes time zone aliases and rejects invalid zones", () => {
    expect(normalizeProviderTimeZone("chicago")).toBe("America/Chicago");
    expect(normalizeProviderTimeZone("Africa/Lagos")).toBe("Africa/Lagos");
    expect(normalizeProviderTimeZone("not-a-zone")).toBeUndefined();
  });

  it("normalizes TikTok minute-second values", () => {
    expect(normalizeProviderMinuteSecond("0:08")).toBe("0:08");
    expect(normalizeProviderMinuteSecond("00:08")).toBe("0:08");
    expect(normalizeProviderMinuteSecond("9:40")).toBe("9:40");
    expect(normalizeProviderMinuteSecond("09:40")).toBe("9:40");
    expect(normalizeProviderMinuteSecond("59:59")).toBe("59:59");
    expect(normalizeProviderMinuteSecond("60:00")).toBeUndefined();
  });

  it("validates release time and sanitizes rights text", () => {
    expect(normalizeProviderReleaseTime("17:47")).toBe("17:47");
    expect(normalizeProviderReleaseTime("25:00")).toBeUndefined();
    expect(normalizeRightsText("© ️2026 Label Name")).toBe("2026 Label Name");
    expect(normalizeRightsText("℗ 2026 Label Name")).toBe("2026 Label Name");
  });

  it("removes invisible unicode without damaging visible text", () => {
    expect(normalizeProviderText("Miguel\u00a0Zambrano\ufe0f")).toBe("Miguel Zambrano");
  });
});
