import { describe, expect, it } from "vitest";
import { assertOutboundAttachment, isTrustedAttachment } from "./attachments";

describe("attachment trust", () => {
  it("allows pdf/images and rejects executables", () => {
    expect(isTrustedAttachment({ filename: "a.pdf", contentType: "application/pdf" })).toBe(
      true
    );
    expect(isTrustedAttachment({ filename: "x.exe", contentType: "application/pdf" })).toBe(
      false
    );
    expect(isTrustedAttachment({ filename: "note.txt", contentType: "text/plain" })).toBe(
      true
    );
    expect(isTrustedAttachment({ filename: "page.html", contentType: "text/html" })).toBe(
      false
    );
  });

  it("rejects oversized outbound files", () => {
    const r = assertOutboundAttachment({
      filename: "a.pdf",
      contentType: "application/pdf",
      size: 20 * 1024 * 1024,
    });
    expect(r.ok).toBe(false);
  });
});
