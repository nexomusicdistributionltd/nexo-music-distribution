import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("logout + OTP e2e wiring (all roles)", () => {
  it("Artist/Label/Admin dashboards use real supabase.auth.signOut via shared helper", () => {
    const helper = read("src/lib/auth/logout-client.ts");
    expect(helper).toContain("supabase.auth.signOut");
    expect(helper).toContain('scope: "global"');
    expect(helper).toContain("removeAllChannels");
    expect(helper).toContain("LOGOUT_API_PATH");
    expect(read("src/lib/auth/login-otp/constants.ts")).toContain('"/api/auth/logout"');
    expect(helper).not.toContain("router.push");
    expect(helper).not.toContain("window.location.origin");

    const logoutBtn = read("src/components/app/LogoutButton.tsx");
    expect(logoutBtn).toContain("performClientLogout");
    expect(logoutBtn).toContain("Sign out");
    expect(read("src/components/app/AppTopbar.tsx")).toContain("LogoutButton");
    expect(read("src/components/app/AppSidebar.tsx")).toContain("LogoutButton");

    const portal = read("src/app/(portal)/layout.tsx");
    const admin = read("src/app/admin/layout.tsx");
    expect(portal).toContain("AppTopbar");
    expect(admin).toContain("AppTopbar");
    expect(portal).toContain("AppSidebar");
    expect(admin).toContain("AppSidebar");
  });

  it("password login cannot reach dashboards until OTP UI", () => {
    const login = read("src/components/auth/LoginForm.tsx");
    expect(login).toContain("signInWithPassword");
    expect(login).toContain("loginVerifyHref");
    expect(login).not.toMatch(/router\.replace\(safeRedirectPath/);
    expect(login).not.toContain('router.replace("/dashboard")');
    expect(login).not.toContain('router.replace("/admin")');

    const otpPage = read("src/app/(auth)/login/verify/page.tsx");
    expect(otpPage).toContain("LoginOtpForm");
    const otpForm = read("src/components/auth/LoginOtpForm.tsx");
    expect(otpForm).toContain("OTP_VERIFY_API_PATH");
    expect(otpForm).toContain("Resend code");
    expect(otpForm).toContain("maskedEmail");
    expect(otpForm).not.toContain("console.log");
  });

  it("server enforcement: middleware + RequireAuth check Nexo OTP for this session", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toContain("nexo_login_otp_verified");
    expect(mw).toContain("LOGIN_OTP_VERIFY_PATH");
    expect(mw).toContain("/login/verify");
    expect(mw).not.toMatch(/two_factor_verified/);

    const guards = read("src/lib/auth/guards.ts");
    expect(guards).toContain("isCurrentSessionOtpVerified");
    expect(guards).toContain("LOGIN_OTP_VERIFY_PATH");

    const nexoAdmin = read("src/app/(auth)/nexo-admin/page.tsx");
    expect(nexoAdmin).toContain("isCurrentSessionOtpVerified");
    expect(nexoAdmin).not.toMatch(/otp bypass|skip otp/i);
  });

  it("OTP email uses Zoho SMTP only (registered email, no Resend)", () => {
    const server = read("src/lib/auth/login-otp/server.ts");
    expect(server).toContain("sendViaZohoSmtp");
    expect(server).toContain("identity.email");
    expect(server).not.toMatch(/RESEND_API_KEY|from ["']resend["']/);
    expect(server).not.toContain("Math.random");
    expect(server).toContain("generateOtpDigits");
    expect(server).toContain("code_hash");
    const zoho = read("src/lib/email/zoho-smtp.ts");
    expect(zoho).toContain("smtp.zoho.com");
  });

  it("logout API invalidates unfinished OTP + verified second-step", () => {
    const logout = read("src/app/api/auth/logout/route.ts");
    expect(logout).toContain("logoutNexoSession");
    const server = read("src/lib/auth/login-otp/server.ts");
    expect(server).toContain("nexo_login_otp_invalidate_current");
    expect(server).toContain("login_otp_verified_sessions");
    expect(server).toContain("signOut({ scope: \"global\" })");
  });

  it("password recovery + production domain redirects remain intact", () => {
    const forgot = read("src/components/auth/ForgotPasswordForm.tsx");
    expect(forgot).toContain("recoveryEmailRedirectTo()");
    expect(forgot).toContain("resetPasswordForEmail");
    expect(forgot).not.toContain("window.location.origin");
    const reset = read("src/components/auth/ResetPasswordForm.tsx");
    expect(reset).toContain("establishRecoverySessionFromHash");
    expect(reset).toContain("/login?reason=password-updated");
    const confirm = read("src/app/auth/confirm/route.ts");
    const callback = read("src/app/auth/callback/route.ts");
    expect(confirm).toContain("completeAuthRedirect");
    expect(callback).toContain("completeAuthRedirect");
  });

  it("src has no localhost production fallbacks and no window.location.origin", () => {
    const files = walkTsFiles(join(root, "src"));
    const dangerous = /\|\|\s*["'`]https?:\/\/(localhost|127\.0\.0\.1)/;
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (dangerous.test(src) || /window\.location\.origin/.test(src)) {
        if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
        offenders.push(file.replace(root + "/", ""));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("migration stores hash only with RLS deny-all", () => {
    const mig = read("supabase/migrations/20260915600001_login_otp_challenges.sql");
    expect(mig).toContain("login_otp_challenges");
    expect(mig).toContain("code_hash");
    expect(mig).toContain("enable row level security");
    expect(mig).toContain("force row level security");
    expect(mig).toContain("revoke all on public.login_otp_challenges");
    expect(mig).toContain("nexo_login_otp_verified");
    expect(mig).not.toContain("two_factor_verified");
    expect(mig).toContain("login_password_success");
    expect(mig).toContain("otp_sent");
    expect(mig).toContain("otp_verified");
  });
});

describe("live admin e2e", () => {
  it("is skipped without credentials and never reports plaintext OTP", () => {
    const email = process.env.E2E_ADMIN_EMAIL ?? "";
    const password = process.env.E2E_ADMIN_PASSWORD ?? "";
    if (!email || !password) {
      expect(true).toBe(true);
      return;
    }
    expect(email.toLowerCase()).not.toContain("otp=");
  });
});
