import { describe, expect, it } from "vitest";
import {
  SERVICE_ROLE_ENV_NAMES,
  getServiceRoleKey,
  getServiceRoleKeyStatus,
} from "./admin";

describe("service role env", () => {
  it("reads the canonical Netlify name", () => {
    expect(SERVICE_ROLE_ENV_NAMES[0]).toBe("SUPABASE_SERVICE_ROLE_KEY");
    expect(
      getServiceRoleKey({
        SUPABASE_SERVICE_ROLE_KEY: "sr-canonical",
      } as NodeJS.ProcessEnv)
    ).toBe("sr-canonical");
  });

  it("accepts documented aliases when the canonical name is unset", () => {
    expect(
      getServiceRoleKey({
        SUPABASE_SERVICE_ROLE: " sr-alias ",
      } as NodeJS.ProcessEnv)
    ).toBe("sr-alias");
    expect(
      getServiceRoleKey({
        SUPABASE_SECRET_KEY: "sr-secret",
      } as NodeJS.ProcessEnv)
    ).toBe("sr-secret");
  });

  it("prefers the canonical name over aliases", () => {
    expect(
      getServiceRoleKey({
        SUPABASE_SERVICE_ROLE_KEY: "canonical",
        SUPABASE_SERVICE_ROLE: "alias",
        SUPABASE_SECRET_KEY: "secret",
      } as NodeJS.ProcessEnv)
    ).toBe("canonical");
  });

  it("never uses the anon key as a service role", () => {
    const anon = "anon-public-key";
    expect(
      getServiceRoleKey({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
        SUPABASE_SERVICE_ROLE_KEY: anon,
      } as NodeJS.ProcessEnv)
    ).toBe("");
    expect(
      getServiceRoleKeyStatus({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
        SUPABASE_SERVICE_ROLE_KEY: anon,
      } as NodeJS.ProcessEnv)
    ).toBe("invalid_anon");
  });

  it("never reads NEXT_PUBLIC_ service role names", () => {
    expect(
      getServiceRoleKey({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leaked",
      } as NodeJS.ProcessEnv)
    ).toBe("");
    expect(getServiceRoleKeyStatus({} as NodeJS.ProcessEnv)).toBe("absent");
  });
});
