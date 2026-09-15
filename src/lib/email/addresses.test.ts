import { describe, expect, it } from "vitest";
import {
  excludeAddress,
  isValidEmailAddress,
  parseAddressList,
  uniqueAddresses,
} from "./addresses";

describe("parseAddressList", () => {
  it("splits comma/newline lists and drops invalid", () => {
    expect(
      parseAddressList("Ada@Nexo.COM, not-an-email\nbob@nexo.test; ada@nexo.com")
    ).toEqual(["ada@nexo.com", "bob@nexo.test"]);
  });

  it("rejects empty and oversize", () => {
    expect(isValidEmailAddress("")).toBe(false);
    expect(isValidEmailAddress("a@b")).toBe(false);
    expect(isValidEmailAddress("ok@nexo.test")).toBe(true);
  });
});

describe("uniqueAddresses / exclude", () => {
  it("dedupes and drops self for Reply All", () => {
    const all = uniqueAddresses(
      ["from@nexo.test"],
      ["to@nexo.test", "contact@nexomusicdistro.space"],
      ["cc@nexo.test"]
    );
    expect(excludeAddress(all, "contact@nexomusicdistro.space")).toEqual([
      "from@nexo.test",
      "to@nexo.test",
      "cc@nexo.test",
    ]);
  });
});
