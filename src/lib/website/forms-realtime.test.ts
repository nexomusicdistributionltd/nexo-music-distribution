import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../..");

describe("website forms + admin realtime", () => {
  it("public contact form persists via /api/contact RPC (no mock)", () => {
    const form = readFileSync(join(root, "src/components/marketing/ContactForm.tsx"), "utf8");
    expect(form).toContain('fetch("/api/contact"');
    expect(form).not.toMatch(/ComingSoon|TODO.*mock/i);
    const api = readFileSync(join(root, "src/app/api/contact/route.ts"), "utf8");
    expect(api).toContain('rpc("submit_contact_message"');
    const admin = readFileSync(join(root, "src/app/admin/contact/page.tsx"), "utf8");
    expect(admin).toContain('from("contact_messages")');
  });

  it("newsletter form persists via /api/newsletter/subscribe (Zoho outbound, no Resend)", () => {
    const form = readFileSync(join(root, "src/components/newsletter/NewsletterForm.tsx"), "utf8");
    expect(form).toContain('fetch("/api/newsletter/subscribe"');
    const send = readFileSync(join(root, "src/lib/email/newsletter-send.ts"), "utf8");
    expect(send).toMatch(/Zoho/i);
    expect(send).toContain("No Resend path");
  });

  it("staff realtime includes contact_messages inserts", () => {
    const rt = readFileSync(join(root, "src/components/notifications/RealtimeRefresh.tsx"), "utf8");
    expect(rt).toContain('table: "contact_messages"');
    const mig = readFileSync(
      join(root, "supabase/migrations/20260915500002_contact_messages_realtime.sql"),
      "utf8"
    );
    expect(mig).toContain("alter publication supabase_realtime add table public.contact_messages");
  });

  it("auth email redirects do not use window.location.origin", () => {
    for (const rel of [
      "src/components/auth/RegisterForm.tsx",
      "src/components/auth/ForgotPasswordForm.tsx",
      "src/components/auth/VerifyEmailPanel.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).not.toContain("window.location.origin");
      expect(src).toContain("authEmailRedirectUrl");
    }
  });
});
