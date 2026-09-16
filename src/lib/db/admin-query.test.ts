import { describe, expect, it } from "vitest";
import {
  adminListErrorMessage,
  caughtAdminQueryError,
  isMissingRelationError,
  unwrapAdminList,
} from "./admin-query";

describe("admin query error mapping", () => {
  it("detects missing tables and PostgREST schema cache errors", () => {
    expect(isMissingRelationError({ code: "42P01" })).toBe(true);
    expect(isMissingRelationError({ code: "PGRST205" })).toBe(true);
    expect(
      isMissingRelationError({ message: "relation public.billing_subscriptions does not exist" })
    ).toBe(true);
    expect(
      isMissingRelationError({
        message: "Could not find a relationship between 'billing_subscriptions' and 'profiles' in the schema cache",
      })
    ).toBe(true);
    expect(isMissingRelationError({ message: "permission denied" })).toBe(false);
  });

  it("returns empty items instead of throwing semantics", () => {
    const missing = unwrapAdminList({
      data: null,
      error: { code: "42P01", message: "relation billing_subscriptions does not exist" },
    });
    expect(missing.items).toEqual([]);
    expect(missing.errorKind).toBe("missing_relation");
    expect(missing.error).toMatch(/missing table/i);
    expect(missing.error).not.toMatch(/something went wrong/i);

    const ok = unwrapAdminList({ data: [{ id: "1" }], error: null });
    expect(ok.items).toEqual([{ id: "1" }]);
    expect(ok.error).toBeNull();
  });

  it("maps thrown query errors to an empty list result", () => {
    const result = caughtAdminQueryError({
      code: "PGRST205",
      message: "Could not find the table 'public.billing_subscriptions' in the schema cache",
    });
    expect(result.items).toEqual([]);
    expect(result.errorKind).toBe("missing_relation");
  });

  it("does not leak SQLSTATE internals", () => {
    expect(adminListErrorMessage({ message: "SQLSTATE 42P01 permission denied" })).toBe(
      "Could not load this list."
    );
  });
});
