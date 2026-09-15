import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  RECOVERY_EMAIL_REDIRECT_PATH,
  RESET_PASSWORD_PATH,
  authCallbackNext,
  recoveryFailurePath,
  resetPasswordForwardPath,
} from "./recovery-urls";
import { authEmailRedirectUrl } from "@/lib/site-url";

const root = join(__dirname, "../../..");

describe("password recovery URLs / session routing", () => {
  it("forgot-password PKCE redirectTo hits /auth/callback with next=/reset-password", () => {
    expect(RECOVERY_EMAIL_REDIRECT_PATH).toBe("/auth/callback?next=/reset-password");
    expect(authEmailRedirectUrl(RECOVERY_EMAIL_REDIRECT_PATH)).toBe(
      "https://nexomusicdistribution.com/auth/callback?next=/reset-password"
    );
    const forgot = readFileSync(
      join(root, "src/components/auth/ForgotPasswordForm.tsx"),
      "utf8"
    );
    expect(forgot).toContain("RECOVERY_EMAIL_REDIRECT_PATH");
    expect(forgot).not.toContain('authEmailRedirectUrl("/reset-password")');
    expect(forgot).not.toContain("window.location.origin");
  });

  it("callback next: recovery OTP defaults to /reset-password; others to /dashboard", () => {
    expect(authCallbackNext("/reset-password")).toBe("/reset-password");
    expect(authCallbackNext(null, "recovery")).toBe(RESET_PASSWORD_PATH);
    expect(authCallbackNext(null, "signup")).toBe("/dashboard");
    expect(authCallbackNext("https://evil.example", "recovery")).toBe("/reset-password");
  });

  it("forwards reset-password auth params to existing SSR routes (token_hash wins)", () => {
    expect(
      resetPasswordForwardPath({ token_hash: "th", type: "recovery", code: "pkce" })
    ).toBe("/auth/confirm?token_hash=th&type=recovery&next=%2Freset-password");
    expect(resetPasswordForwardPath({ code: "pkce" })).toBe(
      "/auth/callback?code=pkce&next=%2Freset-password"
    );
    expect(resetPasswordForwardPath({})).toBeNull();
  });

  it("failed recovery exchange returns to reset-password, not a mixed implicit hash flow", () => {
    expect(recoveryFailurePath("/reset-password")).toBe(
      "/reset-password?reason=invalid-or-expired"
    );
    expect(recoveryFailurePath("/dashboard", "recovery")).toBe(
      "/reset-password?reason=invalid-or-expired"
    );
    expect(recoveryFailurePath("/dashboard")).toBe("/login?reason=auth-required");
  });

  it("callback/confirm bind session cookies onto the redirect response", () => {
    const helper = readFileSync(join(root, "src/lib/supabase/auth-redirect.ts"), "utf8");
    expect(helper).toContain("exchangeCodeForSession");
    expect(helper).toContain("verifyOtp");
    expect(helper).toContain("redirect.cookies.set");
    expect(helper).not.toContain("createClient()");
    const callback = readFileSync(join(root, "src/app/auth/callback/route.ts"), "utf8");
    expect(callback).toContain('completeAuthRedirect(request, "pkce")');
    const confirm = readFileSync(join(root, "src/app/auth/confirm/route.ts"), "utf8");
    expect(confirm).toContain('completeAuthRedirect(request, "otp")');
  });

  it("Set New Password waits for getUser session and does not update without it", () => {
    const form = readFileSync(
      join(root, "src/components/auth/ResetPasswordForm.tsx"),
      "utf8"
    );
    expect(form).toContain("getUser()");
    expect(form).toContain("sessionReady");
    expect(form).toContain("PASSWORD_RECOVERY");
    expect(form).toContain("updateUser({ password })");
    expect(form.indexOf("getUser()")).toBeLessThan(form.lastIndexOf("updateUser({ password })"));
    expect(form).toContain("signOut()");
    expect(form).toContain("/login?reason=password-updated");
    expect(form).not.toContain("console.log");
    const page = readFileSync(
      join(root, "src/app/(auth)/reset-password/page.tsx"),
      "utf8"
    );
    expect(page).toContain("resetPasswordForwardPath");
    expect(page).not.toContain("exchangeCodeForSession");
    expect(page).not.toContain("verifyOtp");
  });
});
