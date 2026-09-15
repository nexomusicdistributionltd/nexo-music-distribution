import { describe, expect, it } from "vitest";
import {
  establishRecoverySessionFromHash,
  parseRecoveryHash,
  recoveryImplicitReroute,
  stripLocationHash,
} from "./recovery-implicit";

describe("implicit recovery hash (GoTrue type=recovery)", () => {
  const dummyHash = "#access_token=dummy-access&refresh_token=dummy-refresh&type=recovery";

  it("parses type=recovery hash tokens without treating other types as recovery", () => {
    const parsed = parseRecoveryHash(dummyHash);
    expect(parsed.kind).toBe("tokens");
    if (parsed.kind === "tokens") {
      expect(parsed.tokens.access_token).toBe("dummy-access");
      expect(parsed.tokens.refresh_token).toBe("dummy-refresh");
    }
    expect(parseRecoveryHash("#access_token=x&refresh_token=y&type=signup").kind).toBe("none");
    expect(parseRecoveryHash("").kind).toBe("none");
    expect(parseRecoveryHash("#error=access_denied&type=recovery").kind).toBe("invalid");
    expect(parseRecoveryHash("#type=recovery").kind).toBe("invalid");
  });

  it("reroutes recovery hash from Site URL / onto /reset-password, keeping the original hash", () => {
    expect(recoveryImplicitReroute("/", dummyHash)).toBe(`/reset-password${dummyHash}`);
    expect(recoveryImplicitReroute("/login", dummyHash)).toBe(`/reset-password${dummyHash}`);
    expect(recoveryImplicitReroute("/reset-password", dummyHash)).toBeNull();
    expect(recoveryImplicitReroute("/", "#type=signup&access_token=x&refresh_token=y")).toBeNull();
  });

  it("strips hash from the path for history.replaceState", () => {
    expect(stripLocationHash("/reset-password", "")).toBe("/reset-password");
    expect(stripLocationHash("/reset-password", "?reason=x")).toBe("/reset-password?reason=x");
  });

  it("setSession then getUser is required before a recovery session is ready", async () => {
    const calls: string[] = [];
    const auth = {
      async setSession() {
        calls.push("setSession");
        return { error: null };
      },
      async getUser() {
        calls.push("getUser");
        return { data: { user: { id: "user-1" } }, error: null };
      },
    };
    await expect(establishRecoverySessionFromHash(auth, dummyHash)).resolves.toBe("ready");
    expect(calls).toEqual(["setSession", "getUser"]);
    await expect(establishRecoverySessionFromHash(auth, "")).resolves.toBe("none");
    await expect(
      establishRecoverySessionFromHash(auth, "#error=expired&type=recovery")
    ).resolves.toBe("invalid");
  });

  it("returns invalid when setSession fails", async () => {
    const auth = {
      async setSession() {
        return { error: { message: "bad" } };
      },
      async getUser() {
        return { data: { user: { id: "user-1" } }, error: null };
      },
    };
    await expect(establishRecoverySessionFromHash(auth, dummyHash)).resolves.toBe("invalid");
  });
});
