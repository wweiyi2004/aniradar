import { describe, it, expect } from "vitest";
import { shouldReanalyze } from "../src/reanalyzePlan";

describe("shouldReanalyze", () => {
  it("mock 来源且已挂事件 → 需要重分析", () => {
    expect(shouldReanalyze({ aiSource: "mock", eventId: "e1" })).toBe(true);
  });
  it("已是 ai 来源 → 不再重分析", () => {
    expect(shouldReanalyze({ aiSource: "ai", eventId: "e1" })).toBe(false);
  });
  it("无关联事件 → 不重分析", () => {
    expect(shouldReanalyze({ aiSource: "mock", eventId: null })).toBe(false);
  });
  it("aiSource 为空 → 不重分析", () => {
    expect(shouldReanalyze({ aiSource: null, eventId: "e1" })).toBe(false);
  });
});
