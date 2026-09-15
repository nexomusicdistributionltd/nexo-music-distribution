import { describe, expect, it } from "vitest";
import { wrapBrandedHtml, ADMIN_COMPOSE_TEMPLATE_KEY } from "./compose-send";

describe("wrapBrandedHtml", () => {
  it("uses the Nexo dark shell when present", () => {
    const html = wrapBrandedHtml({
      subject: "Hello <Nexo>",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("#050505");
    expect(html).toContain("Nexo Music Distribution LTD");
    expect(html).toContain("Hello &lt;Nexo&gt;");
    expect(html).not.toMatch(/resend/i);
    expect(ADMIN_COMPOSE_TEMPLATE_KEY).toBe("ADMIN_COMPOSE");
  });
});
