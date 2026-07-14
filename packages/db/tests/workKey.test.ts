import { describe, expect, it } from "vitest";
import { normalizeWorkKey, workKeyFromFacts } from "../src/workKey";

describe("workKey", () => {
  it("normalizes width, case and whitespace", () => {
    expect(normalizeWorkKey("  ＡＮＩＭＥ   Title  ")).toBe("anime title");
  });

  it("extracts only a non-empty facts.work", () => {
    expect(workKeyFromFacts({ work: "  葬送のフリーレン " })).toBe("葬送のフリーレン");
    expect(workKeyFromFacts({ work: "" })).toBeNull();
    expect(workKeyFromFacts(null)).toBeNull();
  });
});
