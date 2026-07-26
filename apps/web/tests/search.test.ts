import { describe, expect, it } from "vitest";
import { sanitizeSearchQuery } from "../lib/search";

describe("sanitizeSearchQuery", () => {
  it("neutralizes LIKE wildcards", () => {
    expect(sanitizeSearchQuery("100%")).toBe("100");
    expect(sanitizeSearchQuery("a_b")).toBe("a b");
    expect(sanitizeSearchQuery("%%%")).toBe("");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchQuery("  海贼  王  ")).toBe("海贼 王");
    expect(sanitizeSearchQuery("鬼灭之刃")).toBe("鬼灭之刃");
  });
});
