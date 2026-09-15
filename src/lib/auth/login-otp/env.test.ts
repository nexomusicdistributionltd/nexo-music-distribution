import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OTP_PEPPER_ENV_NAME,
  OTP_UNAVAILABLE_USER_MESSAGE,
  challengeWriteLooksLikeMissingTable,
  getOtpPepper,
  loginOtpHealthSnapshot,
} from "./env";

describe("login OTP env", () => {
  it("uses a dedicated pepper when set", () => {
    expect(OTP_PEPPER_ENV_NAME).toBe("NEXO_OTP_PEPPER");
    expect(
      getOtpPepper({
        NEXO_OTP_PEPPER: "pepper",
        SUPABASE_SERVICE_ROLE_KEY: "sr",
      } as NodeJS.ProcessEnv)
    ).toBe("pepper");
  });

  it("falls back to the service role key, including aliases", () => {
    expect(
      getOtpPepper({
        SUPABASE_SERVICE_ROLE: "sr-alias",
      } as NodeJS.ProcessEnv)
    ).toBe("sr-alias");
  });

  it("reports send/verify readiness without leaking secrets", () => {
    const missing = loginOtpHealthSnapshot({} as NodeJS.ProcessEnv, true);
    expect(missing.serviceRole).toBe("absent");
    expect(missing.smtp).toBe("present");
    expect(missing.pepper).toBe("absent");
    expect(missing.sendReady).toBe(false);
    expect(missing.verifyReady).toBe(false);

    const ready = loginOtpHealthSnapshot(
      { SUPABASE_SERVICE_ROLE_KEY: "sr-key" } as NodeJS.ProcessEnv,
      true
    );
    expect(ready.serviceRole).toBe("present");
    expect(ready.pepper).toBe("present");
    expect(ready.sendReady).toBe(true);
    expect(ready.verifyReady).toBe(true);
    expect(JSON.stringify(ready)).not.toContain("sr-key");
  });

  it("maps missing-table write errors", () => {
    expect(challengeWriteLooksLikeMissingTable({ code: "42P01" })).toBe(true);
    expect(challengeWriteLooksLikeMissingTable({ message: "relation login_otp_challenges does not exist" })).toBe(
      true
    );
    expect(challengeWriteLooksLikeMissingTable({ message: "permission denied" })).toBe(false);
  });

  it("user-facing unavailable copy does not mention env names", () => {
    expect(OTP_UNAVAILABLE_USER_MESSAGE.toLowerCase()).not.toMatch(/service.?role|pepper|supabase|smtp/);
  });
});

describe("login OTP server wiring", () => {
  it("fails closed when the backend is not ready and never grants access on send failure", () => {
    const server = readFileSync(join(process.cwd(), "src/lib/auth/login-otp/server.ts"), "utf8");
    expect(server).toContain("loginOtpHealthSnapshot");
    expect(server).toContain("OTP_UNAVAILABLE_USER_MESSAGE");
    expect(server).toContain("OTP_SEND_FAILED_USER_MESSAGE");
    expect(server).toContain("challengeWriteLooksLikeMissingTable");
    expect(server).not.toMatch(/paidAccess\s*=\s*true/);
    expect(server).toContain("createServiceClient");
    const health = readFileSync(join(process.cwd(), "src/app/api/health/route.ts"), "utf8");
    expect(health).toContain("loginOtp");
    expect(health).toContain("login_otp_challenges");
  });
});
