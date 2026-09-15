import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  RECOVERY_EMAIL_REDIRECT_PATH,
  RESET_PASSWORD_PATH,
  authCallbackNext,
  recoveryEmailRedirectTo,
  recoveryFailurePath,
  resetPasswordForwardPath,
} from "./recovery-urls";
import { authEmailRedirectUrl } from "@/lib/site-url";

const root = join(__dirname, "../../..");

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("password recovery URLs / session routing", () => {
  it("forgot-password redirectTo is the real /reset-password route on the official domain", () => {
    expect(RECOVERY_EMAIL_REDIRECT_PATH).toBe("/reset-password");
    expect(RECOVERY_EMAIL_REDIRECT_PATH).toBe(RESET_PASSWORD_PATH);
    expect(recoveryEmailRedirectTo()).toBe("https://nexomusicdistribution.com/reset-password");
    expect(authEmailRedirectUrl(RECOVERY_EMAIL_REDIRECT_PATH)).toBe(
      "https://nexomusicdistribution.com/reset-password"
    );
    const forgot = readFileSync(
      join(root, "src/components/auth/ForgotPasswordForm.tsx"),
      "utf8"
    );
    expect(forgot).toContain("recoveryEmailRedirectTo()");
    expect(forgot).toContain("resetPasswordForEmail");
    expect(forgot).not.toContain("window.location.origin");
    expect(forgot).not.toContain("localhost");
    expect(forgot).not.toContain("nexomusicdistro.space");
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

  it("failed recovery exchange returns to reset-password", () => {
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

  it("Set New Password establishes implicit recovery session before updateUser", () => {
    const form = readFileSync(
      join(root, "src/components/auth/ResetPasswordForm.tsx"),
      "utf8"
    );
    expect(form).toContain("establishRecoverySessionFromHash");
    expect(form).toContain("getUser()");
    expect(form).toContain("sessionReady");
    expect(form).toContain("PASSWORD_RECOVERY");
    expect(form).toContain("updateUser({ password })");
    expect(form.indexOf("establishRecoverySessionFromHash")).toBeLessThan(
      form.lastIndexOf("updateUser({ password })")
    );
    expect(form.indexOf("getUser()")).toBeLessThan(form.lastIndexOf("updateUser({ password })"));
    expect(form).toContain("signOut()");
    expect(form).toContain("/login?reason=password-updated");
    expect(form).not.toContain("console.log");
    expect(form).not.toContain("access_token");
    const page = readFileSync(
      join(root, "src/app/(auth)/reset-password/page.tsx"),
      "utf8"
    );
    expect(page).toContain("resetPasswordForwardPath");
    expect(page).not.toContain("exchangeCodeForSession");
    expect(page).not.toContain("verifyOtp");
    const implicit = readFileSync(join(root, "src/lib/auth/recovery-implicit.ts"), "utf8");
    expect(implicit).toContain("setSession");
    expect(implicit).toContain("type=recovery");
    const client = readFileSync(join(root, "src/lib/supabase/client.ts"), "utf8");
    expect(client).toContain("detectSessionInUrl: false");
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("RecoveryHashCatcher");
  });

  it("src has no localhost production fallbacks for site/app/auth URLs", () => {
    const files = walkTsFiles(join(root, "src"));
    const dangerous =
      /\|\|\s*["'`]https?:\/\/(localhost|127\.0\.0\.1)/;
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (dangerous.test(src) || /window\.location\.origin/.test(src)) {
        if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
        offenders.push(file.replace(root + "/", ""));
      }
    }
    expect(offenders).toEqual([]);

    const resetCallers = files.filter((f) => {
      if (f.includes(".test.")) return false;
      return readFileSync(f, "utf8").includes("resetPasswordForEmail");
    });
    expect(resetCallers.map((f) => f.replace(root + "/", "")).sort()).toEqual(
      [
        "src/components/auth/ForgotPasswordForm.tsx",
        "src/lib/auth/recovery-urls.ts",
      ].sort()
    );
  });
});
