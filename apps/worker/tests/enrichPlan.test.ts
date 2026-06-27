import { describe, it, expect } from "vitest";
import { pickToEnrich, type FreshEntry } from "../src/enrichPlan";

function entry(hash: string, ts?: number): FreshEntry {
  return {
    hash,
    item: {
      title: hash,
      url: `https://x/${hash}`,
      publishedAt: ts === undefined ? undefined : new Date(ts),
      publishedTimePrecision: "unknown",
    },
  };
}

describe("pickToEnrich", () => {
  it("按 publishedAt 倒序取前 max 条增强", () => {
    const fresh = [entry("a", 1000), entry("b", 3000), entry("c", 2000)];
    const { toEnrich, rest } = pickToEnrich(fresh, 2);
    expect(toEnrich.map((e) => e.hash)).toEqual(["b", "c"]);
    expect(rest.map((e) => e.hash)).toEqual(["a"]);
  });
  it("无日期的条目排在末尾", () => {
    const fresh = [entry("a"), entry("b", 5000)];
    const { toEnrich } = pickToEnrich(fresh, 1);
    expect(toEnrich.map((e) => e.hash)).toEqual(["b"]);
  });
  it("max >= 长度时 rest 为空", () => {
    const fresh = [entry("a", 1), entry("b", 2)];
    expect(pickToEnrich(fresh, 5).rest).toEqual([]);
  });
  it("max <= 0 时全部进 rest", () => {
    const fresh = [entry("a", 1)];
    const { toEnrich, rest } = pickToEnrich(fresh, 0);
    expect(toEnrich).toEqual([]);
    expect(rest.map((e) => e.hash)).toEqual(["a"]);
  });
});
